import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import createAircraftModel from '../model/aircraft';
import { CtrlHandler, AuthMiddleware, checkValidationResult } from './utils';
import { createLog } from '../library/utils';
import { hasPermission, PERMISSIONS } from '../library/aviation_permissions';
import { decode } from '../library/signer';

const aircraftModel = createAircraftModel();

// Validation middleware
export const validateAircraftCreation = [
    body('aircraft_id').notEmpty().withMessage('Aircraft ID is required'),
    body('registration').notEmpty().withMessage('Registration is required'),
    body('manufacturer').notEmpty().withMessage('Manufacturer is required'),
    body('model').notEmpty().withMessage('Model is required'),
    body('aircraft_type').isIn(['light_jet', 'midsize_jet', 'super_midsize', 'heavy_jet', 'ultra_long_range', 'turboprop', 'helicopter']).withMessage('Invalid aircraft type'),
    body('year_manufactured').isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Invalid year manufactured'),
    body('serial_number').notEmpty().withMessage('Serial number is required'),
    body('specifications.max_passengers').isInt({ min: 1 }).withMessage('Max passengers must be at least 1'),
    body('specifications.max_range').isInt({ min: 0 }).withMessage('Max range must be non-negative'),
    body('specifications.max_altitude').isInt({ min: 0 }).withMessage('Max altitude must be non-negative'),
    body('specifications.cruise_speed').isInt({ min: 0 }).withMessage('Cruise speed must be non-negative'),
    body('specifications.fuel_capacity').isInt({ min: 0 }).withMessage('Fuel capacity must be non-negative'),
    body('specifications.baggage_capacity').isInt({ min: 0 }).withMessage('Baggage capacity must be non-negative'),
    body('specifications.runway_length_required').isInt({ min: 0 }).withMessage('Runway length required must be non-negative'),
    body('operating_costs.hourly_rate').isFloat({ min: 0 }).withMessage('Hourly rate must be non-negative'),
    body('operating_costs.fuel_consumption').isFloat({ min: 0 }).withMessage('Fuel consumption must be non-negative'),
    body('interior_configuration.seating_capacity').isInt({ min: 1 }).withMessage('Seating capacity must be at least 1'),
    body('scheduling_info.base_location').notEmpty().withMessage('Base location is required'),
    body('current_location.airport_code').notEmpty().withMessage('Current location airport code is required')
];

export const validateAircraftUpdate = [
    body('aircraft_id').optional().notEmpty().withMessage('Aircraft ID cannot be empty'),
    body('registration').optional().notEmpty().withMessage('Registration cannot be empty'),
    body('manufacturer').optional().notEmpty().withMessage('Manufacturer cannot be empty'),
    body('model').optional().notEmpty().withMessage('Model cannot be empty'),
    body('aircraft_type').optional().isIn(['light_jet', 'midsize_jet', 'super_midsize', 'heavy_jet', 'ultra_long_range', 'turboprop', 'helicopter']).withMessage('Invalid aircraft type'),
    body('year_manufactured').optional().isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Invalid year manufactured'),
    body('specifications.max_passengers').optional().isInt({ min: 1 }).withMessage('Max passengers must be at least 1'),
    body('specifications.max_range').optional().isInt({ min: 0 }).withMessage('Max range must be non-negative'),
    body('current_status').optional().isIn(['available', 'in_flight', 'maintenance', 'scheduled', 'out_of_service', 'inspection']).withMessage('Invalid status'),
    body('operating_costs.hourly_rate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be non-negative')
];

export const validateAircraftSearch = [
    query('aircraft_type').optional().isIn(['light_jet', 'midsize_jet', 'super_midsize', 'heavy_jet', 'ultra_long_range', 'turboprop', 'helicopter']).withMessage('Invalid aircraft type'),
    query('current_status').optional().isIn(['available', 'in_flight', 'maintenance', 'scheduled', 'out_of_service', 'inspection']).withMessage('Invalid status'),
    query('max_passengers').optional().isInt({ min: 1 }).withMessage('Max passengers must be at least 1'),
    query('available_for_charter').optional().isBoolean().withMessage('Available for charter must be boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

export const validateLocationUpdate = [
    body('airport_code').notEmpty().withMessage('Airport code is required'),
    body('airport_name').optional().isString(),
    body('city').optional().isString(),
    body('country').optional().isString()
];

export const validateStatusUpdate = [
    body('status').isIn(['available', 'in_flight', 'maintenance', 'scheduled', 'out_of_service', 'inspection']).withMessage('Invalid status')
];

export const validateBlockedDate = [
    body('start_date').isISO8601().withMessage('Start date must be valid ISO date'),
    body('end_date').isISO8601().withMessage('End date must be valid ISO date'),
    body('reason').optional().isIn(['maintenance', 'owner_use', 'inspection', 'seasonal', 'other']).withMessage('Invalid reason'),
    body('notes').optional().isString()
];

export const validateMaintenanceUpdate = [
    body('last_inspection').optional().isISO8601().withMessage('Last inspection must be valid ISO date'),
    body('next_inspection_due').optional().isISO8601().withMessage('Next inspection due must be valid ISO date'),
    body('inspection_type').optional().isIn(['100_hour', 'annual', 'progressive', 'hot_section', 'overhaul']).withMessage('Invalid inspection type'),
    body('total_flight_hours').optional().isFloat({ min: 0 }).withMessage('Total flight hours must be non-negative'),
    body('maintenance_provider').optional().isString(),
    body('maintenance_location').optional().isString()
];

export const validateNote = [
    body('note').notEmpty().withMessage('Note is required'),
    body('category').optional().isIn(['maintenance', 'operation', 'scheduling', 'performance', 'general']).withMessage('Invalid category'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
];

export const validateAvailabilityQuery = [
    query('start_date').isISO8601().withMessage('Start date must be valid ISO date'),
    query('end_date').isISO8601().withMessage('End date must be valid ISO date'),
    query('location').optional().isString()
];

// Permission check middleware
const checkAircraftPermission = (requiredPermission: number) => {
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

// Basic CRUD operations
router.post('/', checkAircraftPermission(PERMISSIONS.AIRCRAFT_WRITE), validateAircraftCreation, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { _id: createdBy } = res.locals.udata;
        const aircraft = await aircraftModel.createAircraft(body, createdBy);
        
        createLog(createdBy, `Created aircraft: ${aircraft.registration}`, req);
        
        return aircraft;
    });
});

router.put('/:aircraftId', checkAircraftPermission(PERMISSIONS.AIRCRAFT_WRITE), validateAircraftUpdate, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.updateAircraft(aircraftId, body, updatedBy);
        
        createLog(updatedBy, `Updated aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.delete('/:aircraftId', checkAircraftPermission(PERMISSIONS.AIRCRAFT_DELETE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftId } = req.params;
        const { _id: deletedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.deleteAircraft(aircraftId, deletedBy);
        
        createLog(deletedBy, `Deleted aircraft: ${aircraftId}`, req);
        
        return { message: 'Aircraft deleted successfully', aircraft };
    });
});

router.get('/:aircraftId', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftId } = req.params;
        const aircraft = await aircraftModel.getAircraftById(aircraftId);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.get('/registration/:registration', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { registration } = req.params;
        const aircraft = await aircraftModel.getAircraftByRegistration(registration);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by registration: ${registration}`, req);
        
        return aircraft;
    });
});

// Search and filtering
router.get('/', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), validateAircraftSearch, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async () => {
        const searchParams = {
            aircraft_type: req.query.aircraft_type as string,
            manufacturer: req.query.manufacturer as string,
            model: req.query.model as string,
            current_status: req.query.current_status as string,
            max_passengers: req.query.max_passengers ? parseInt(req.query.max_passengers as string) : undefined,
            available_for_charter: req.query.available_for_charter === 'true',
            base_location: req.query.base_location as string,
            search: req.query.search as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20
        };

        const result = await aircraftModel.searchAircraft(searchParams);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Searched aircraft with filters: ${JSON.stringify(searchParams)}`, req);
        
        return result;
    });
});

router.get('/type/:aircraftType', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftType } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        
        const aircraft = await aircraftModel.getAircraftByType(aircraftType, limit);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by type: ${aircraftType}`, req);
        
        return { aircraft, count: aircraft.length };
    });
});

router.get('/status/:status', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { status } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        
        const aircraft = await aircraftModel.getAircraftByStatus(status, limit);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by status: ${status}`, req);
        
        return { aircraft, count: aircraft.length };
    });
});

router.get('/manufacturer/:manufacturer', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { manufacturer } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        
        const aircraft = await aircraftModel.getAircraftByManufacturer(manufacturer, limit);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by manufacturer: ${manufacturer}`, req);
        
        return { aircraft, count: aircraft.length };
    });
});

// Availability and scheduling
router.get('/available', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), validateAvailabilityQuery, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async () => {
        const startDate = new Date(req.query.start_date as string);
        const endDate = new Date(req.query.end_date as string);
        const location = req.query.location as string;
        
        const aircraft = await aircraftModel.getAvailableAircraft(startDate, endDate, location);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Checked aircraft availability: ${startDate.toISOString()} to ${endDate.toISOString()}`, req);
        
        return { aircraft, count: aircraft.length, period: { start_date: startDate, end_date: endDate, location: location || 'any' } };
    });
});

router.put('/:aircraftId/location', checkAircraftPermission(PERMISSIONS.AIRCRAFT_MANAGE), validateLocationUpdate, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.updateAircraftLocation(aircraftId, body, updatedBy);
        
        createLog(updatedBy, `Updated aircraft location: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.put('/:aircraftId/status', checkAircraftPermission(PERMISSIONS.AIRCRAFT_MANAGE), validateStatusUpdate, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { status } = body;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.updateAircraftStatus(aircraftId, status, updatedBy);
        
        createLog(updatedBy, `Updated aircraft status: ${aircraftId} to ${status}`, req);
        
        return aircraft;
    });
});

router.post('/:aircraftId/blocked-dates', checkAircraftPermission(PERMISSIONS.AIRCRAFT_MANAGE), validateBlockedDate, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.addBlockedDate(aircraftId, body, updatedBy);
        
        createLog(updatedBy, `Added blocked date for aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.delete('/:aircraftId/blocked-dates/:blockId', checkAircraftPermission(PERMISSIONS.AIRCRAFT_MANAGE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftId, blockId } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.removeBlockedDate(aircraftId, blockId, updatedBy);
        
        createLog(updatedBy, `Removed blocked date for aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

// Maintenance management
router.get('/maintenance/schedule', checkAircraftPermission(PERMISSIONS.MAINTENANCE_SCHEDULE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const daysAhead = req.query.days_ahead ? parseInt(req.query.days_ahead as string) : 90;
        const schedule = await aircraftModel.getMaintenanceSchedule(daysAhead);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed maintenance schedule`, req);
        
        return { schedule, count: schedule.length, period: `${daysAhead} days ahead` };
    });
});

router.put('/:aircraftId/maintenance', checkAircraftPermission(PERMISSIONS.MAINTENANCE_SCHEDULE), validateMaintenanceUpdate, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { _id: updatedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.updateMaintenanceInfo(aircraftId, body, updatedBy);
        
        createLog(updatedBy, `Updated maintenance info for aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.get('/maintenance/due', checkAircraftPermission(PERMISSIONS.MAINTENANCE_SCHEDULE), (req, res) => {
    CtrlHandler(req, res, async () => {
        const daysAhead = req.query.days_ahead ? parseInt(req.query.days_ahead as string) : 30;
        const aircraft = await aircraftModel.getAircraftDueForMaintenance(daysAhead);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft due for maintenance`, req);
        
        return { aircraft, count: aircraft.length, period: `${daysAhead} days ahead` };
    });
});

// Analytics and reports
router.get('/analytics/fleet', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const statistics = await aircraftModel.getFleetStatistics();
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed fleet statistics`, req);
        
        return statistics;
    });
});

router.get('/analytics/utilization', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const aircraftId = req.query.aircraft_id as string;
        const months = req.query.months ? parseInt(req.query.months as string) : 12;
        
        const utilization = await aircraftModel.getAircraftUtilization(aircraftId, months);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft utilization`, req);
        
        return { utilization, period: `${months} months` };
    });
});

router.get('/analytics/costs', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const aircraftId = req.query.aircraft_id as string;
        const period = req.query.period as string || 'monthly';
        
        const costs = await aircraftModel.getOperatingCostsReport(aircraftId, period);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed operating costs report`, req);
        
        return { costs, period };
    });
});

// Specialized queries
router.get('/capacity', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const minPassengers = parseInt(req.query.min_passengers as string) || 1;
        const maxPassengers = parseInt(req.query.max_passengers as string) || 50;
        
        const aircraft = await aircraftModel.getAircraftByCapacity(minPassengers, maxPassengers);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by capacity: ${minPassengers}-${maxPassengers}`, req);
        
        return { aircraft, count: aircraft.length, capacity_range: { min: minPassengers, max: maxPassengers } };
    });
});

router.get('/range', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const minRange = parseInt(req.query.min_range as string) || 0;
        const maxRange = parseInt(req.query.max_range as string) || 10000;
        
        const aircraft = await aircraftModel.getAircraftByRange(minRange, maxRange);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft by range: ${minRange}-${maxRange}`, req);
        
        return { aircraft, count: aircraft.length, range_filter: { min: minRange, max: maxRange } };
    });
});

router.get('/nearest/:airportCode', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { airportCode } = req.params;
        const maxDistance = req.query.max_distance ? parseInt(req.query.max_distance as string) : 500;
        
        const aircraft = await aircraftModel.getNearestAircraft(airportCode, maxDistance);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed nearest aircraft to: ${airportCode}`, req);
        
        return { aircraft, count: aircraft.length, location: airportCode, max_distance: maxDistance };
    });
});

// Notes and history
router.post('/:aircraftId/notes', checkAircraftPermission(PERMISSIONS.AIRCRAFT_WRITE), validateNote, checkValidationResult, (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const { aircraftId } = req.params;
        const { note, category = 'general', priority = 'medium' } = body;
        const { _id: addedBy } = res.locals.udata;
        
        const aircraft = await aircraftModel.addAircraftNote(aircraftId, note, category, priority, addedBy);
        
        createLog(addedBy, `Added note to aircraft: ${aircraftId}`, req);
        
        return aircraft;
    });
});

router.get('/:aircraftId/history', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        
        const history = await aircraftModel.getAircraftHistory(aircraftId, limit);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Viewed aircraft history: ${aircraftId}`, req);
        
        return history;
    });
});

router.get('/:aircraftId/report', checkAircraftPermission(PERMISSIONS.AIRCRAFT_READ), (req, res) => {
    CtrlHandler(req, res, async () => {
        const { aircraftId } = req.params;
        const report = await aircraftModel.generateAircraftReport(aircraftId);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Generated aircraft report: ${aircraftId}`, req);
        
        return report;
    });
});

// Validation
router.post('/validate', checkAircraftPermission(PERMISSIONS.AIRCRAFT_WRITE), (req, res) => {
    CtrlHandler(req, res, async (body) => {
        const validation = await aircraftModel.validateAircraftData(body);
        
        const { _id: userId } = res.locals.udata;
        createLog(userId, `Validated aircraft data`, req);
        
        return validation;
    });
});

export default router;