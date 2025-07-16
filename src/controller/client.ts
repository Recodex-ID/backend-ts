import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import clientModel from '../model/client';
import { AuthMiddleware, CtrlHandler, checkValidationResult } from './utils';
import { decode } from '../library/signer';
import { createLog } from '../library/utils';
import { hasPermission, PERMISSIONS } from '../library/aviation_permissions';
import { createClientCommunicationService } from '../library/client_communication';

const clientController = clientModel();
const communicationService = createClientCommunicationService();

// Validation middleware for client creation/update
const validateClient = [
    body('contact_person')
        .isLength({ min: 2, max: 100 })
        .withMessage('Contact person name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-'.]+$/)
        .withMessage('Contact person name can only contain letters, spaces, hyphens, apostrophes, and dots'),
    
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    
    body('phone')
        .matches(/^[+]?[0-9\s\-()]+$/)
        .withMessage('Please provide a valid phone number'),
    
    body('first_name')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s\-'.]+$/)
        .withMessage('First name can only contain letters, spaces, hyphens, apostrophes, and dots'),
    
    body('last_name')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s\-'.]+$/)
        .withMessage('Last name can only contain letters, spaces, hyphens, apostrophes, and dots'),
    
    body('company_name')
        .optional()
        .isLength({ min: 2, max: 200 })
        .withMessage('Company name must be between 2 and 200 characters'),
    
    body('client_type')
        .optional()
        .isIn(['individual', 'corporate', 'charter', 'government'])
        .withMessage('Invalid client type'),
    
    body('status')
        .optional()
        .isIn(['active', 'inactive', 'suspended', 'blacklisted'])
        .withMessage('Invalid status'),
    
    body('date_of_birth')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date of birth in ISO format'),
    
    body('passport_expiry')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid passport expiry date in ISO format')
];

// Validation for adding notes
const validateNote = [
    body('note')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Note must be between 1 and 1000 characters'),
    
    body('category')
        .optional()
        .isIn(['general', 'preference', 'complaint', 'compliment', 'billing', 'safety', 'other'])
        .withMessage('Invalid note category'),
    
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Invalid priority level'),
    
    body('is_private')
        .optional()
        .isBoolean()
        .withMessage('is_private must be a boolean value')
];

// Permission check middleware
const checkClientPermission = (requiredPermission: number) => {
    return (req: any, res: any, next: any) => {
        const { level } = res.locals.udata;
        
        if (!hasPermission(level, requiredPermission)) {
            return res.status(403).json({
                error: 403,
                message: 'Insufficient permissions to perform this action'
            });
        }
        
        next();
    };
};

const router = Router();

// Apply authentication middleware to all routes
router.use(AuthMiddleware(decode));

// GET /clients - Search and list clients
router.get('/', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const {
            search,
            status,
            client_type,
            vip_level,
            assigned_account_manager,
            created_from,
            created_to,
            last_contact_from,
            last_contact_to,
            page = 1,
            per_page = 10
        } = req.query;

        const filters = {
            search: search as string,
            status: status as string,
            client_type: client_type as string,
            vip_level: vip_level as string,
            assigned_account_manager: assigned_account_manager as string,
            created_from: created_from as string,
            created_to: created_to as string,
            last_contact_from: last_contact_from as string,
            last_contact_to: last_contact_to as string
        };

        const result = await clientController.search(filters, parseInt(page as string), parseInt(per_page as string));
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Searched clients with filters: ${JSON.stringify(filters)}`, req);
        
        return result;
    });
});

// POST /clients - Create new client
router.post('/', checkClientPermission(PERMISSIONS.CLIENT_WRITE), validateClient, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { _id: createdBy } = res.locals.udata;
        
        const client = await clientController.insert(body, createdBy);
        
        createLog(createdBy, `Created new client: ${body.first_name} ${body.last_name} (${body.email})`, req);
        
        return client;
    });
});

// GET /clients/:id - Get client details
router.get('/:id', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const client = await clientController.getDetail(id);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed client details: ${id}`, req);
        
        return client;
    });
});

// PUT /clients/:id - Update client
router.put('/:id', checkClientPermission(PERMISSIONS.CLIENT_WRITE), validateClient, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const client = await clientController.update(body, id, updatedBy);
        
        createLog(updatedBy, `Updated client: ${id}`, req);
        
        return client;
    });
});

// DELETE /clients/:id - Soft delete client
router.delete('/:id', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const { _id: deletedBy } = res.locals.udata;
        
        const client = await clientController.delete(id, deletedBy);
        
        createLog(deletedBy, `Deleted client: ${id}`, req);
        
        return { message: 'Client deleted successfully', client };
    });
});

// GET /clients/:id/stats - Get client statistics
router.get('/:id/stats', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const stats = await clientController.getStats(id);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed client statistics: ${id}`, req);
        
        return stats;
    });
});

// POST /clients/:id/notes - Add note to client
router.post('/:id/notes', checkClientPermission(PERMISSIONS.CLIENT_WRITE), validateNote, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const { _id: addedBy } = res.locals.udata;
        const { note, category = 'general', priority = 'medium', is_private = false } = body;
        
        const client = await clientController.addNote(id, note, category, priority, addedBy, is_private);
        
        createLog(addedBy, `Added note to client: ${id}`, req);
        
        return { message: 'Note added successfully', client };
    });
});

// PUT /clients/:id/contact - Update last contact date
router.put('/:id/contact', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const client = await clientController.updateContactDate(id);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Updated contact date for client: ${id}`, req);
        
        return { message: 'Contact date updated successfully', client };
    });
});

// GET /clients/vip - Get VIP clients
router.get('/vip/list', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { vip_level } = req.query;
        const clients = await clientController.getVipClients(vip_level as string);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed VIP clients list`, req);
        
        return clients;
    });
});

// GET /clients/manager/:managerId - Get clients by account manager
router.get('/manager/:managerId', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { managerId } = req.params;
        const clients = await clientController.getClientsByManager(managerId);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed clients for manager: ${managerId}`, req);
        
        return clients;
    });
});

// GET /clients/birthdays - Get clients with birthdays this month
router.get('/birthdays/this-month', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { month } = req.query;
        const clients = await clientController.getBirthdayClients(month ? parseInt(month as string) : undefined);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed birthday clients for month: ${month || 'current'}`, req);
        
        return clients;
    });
});

// GET /clients/inactive - Get inactive clients
router.get('/inactive/list', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { days = 30 } = req.query;
        const clients = await clientController.getInactiveClients(parseInt(days as string));
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed inactive clients (${days} days)`, req);
        
        return clients;
    });
});

// Communication Management Routes

// POST /clients/:id/communication - Record communication
router.post('/:id/communication', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const { _id: sentBy } = res.locals.udata;
        const { method, subject, content, response_required = false } = body;
        
        const communication = await communicationService.recordCommunication({
            clientId: id,
            method,
            subject,
            content,
            sentBy,
            responseRequired: response_required
        });
        
        createLog(sentBy, `Recorded communication with client: ${id}`, req);
        
        return { message: 'Communication recorded successfully', communication };
    });
});

// GET /clients/:id/communication-report - Generate communication report
router.get('/:id/communication-report', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const report = await communicationService.generateClientReport(id);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Generated communication report for client: ${id}`, req);
        
        return report;
    });
});

// GET /clients/:id/preferences - Get client preferences
router.get('/:id/preferences', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { id } = req.params;
        const preferences = await communicationService.getClientPreferences(id);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed client preferences: ${id}`, req);
        
        return preferences;
    });
});

// PUT /clients/:id/communication-preferences - Update communication preferences
router.put('/:id/communication-preferences', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const client = await communicationService.updateCommunicationPreferences(id, body);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Updated communication preferences for client: ${id}`, req);
        
        return { message: 'Communication preferences updated successfully', client };
    });
});

// GET /clients/follow-up/inactive - Get inactive clients for follow-up
router.get('/follow-up/inactive', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { days = 30 } = req.query;
        const clients = await communicationService.getInactiveClientsForFollowup(parseInt(days as string));
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Retrieved inactive clients for follow-up (${days} days)`, req);
        
        return clients;
    });
});

// GET /clients/birthdays/:clientId/schedule - Schedule birthday greeting
router.get('/birthdays/:clientId/schedule', checkClientPermission(PERMISSIONS.CLIENT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { clientId } = req.params;
        const birthdayInfo = await communicationService.scheduleBirthdayGreeting(clientId);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Scheduled birthday greeting for client: ${clientId}`, req);
        
        return birthdayInfo;
    });
});

// POST /clients/:id/booking-confirmation - Send booking confirmation
router.post('/:id/booking-confirmation', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const result = await communicationService.sendBookingConfirmation(id, body);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Sent booking confirmation to client: ${id}`, req);
        
        return result;
    });
});

// POST /clients/:id/flight-update - Send flight update
router.post('/:id/flight-update', checkClientPermission(PERMISSIONS.CLIENT_WRITE), (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { id } = req.params;
        const result = await communicationService.sendFlightUpdate(id, body);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Sent flight update to client: ${id}`, req);
        
        return result;
    });
});

export default router;