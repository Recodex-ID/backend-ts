import clientSchema from '../schema/client';
import { createLog } from './utils';
import moment from 'moment';

export interface CommunicationData {
    clientId: string;
    method: 'email' | 'sms' | 'phone' | 'whatsapp' | 'in_person';
    subject: string;
    content: string;
    sentBy: string;
    responseRequired?: boolean;
}

export interface NotificationPreferences {
    booking_confirmations: boolean;
    flight_updates: boolean;
    promotions: boolean;
    surveys: boolean;
}

export interface ClientCommunicationService {
    recordCommunication: (data: CommunicationData) => Promise<any>;
    getPreferredMethod: (clientId: string) => Promise<string>;
    canSendMarketing: (clientId: string) => Promise<boolean>;
    scheduleBirthdayGreeting: (clientId: string) => Promise<any>;
    getInactiveClientsForFollowup: (days: number) => Promise<any>;
    sendBookingConfirmation: (clientId: string, bookingDetails: any) => Promise<any>;
    sendFlightUpdate: (clientId: string, flightDetails: any) => Promise<any>;
    generateClientReport: (clientId: string) => Promise<any>;
    getClientPreferences: (clientId: string) => Promise<any>;
    updateCommunicationPreferences: (clientId: string, preferences: any) => Promise<any>;
}

export const createClientCommunicationService = (): ClientCommunicationService => {
    
    const recordCommunication = async (data: CommunicationData): Promise<any> => {
        const client = await clientSchema.findById(data.clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        // Add to communication history
        client.communication_preferences.communication_history.push({
            date: new Date(),
            method: data.method,
            subject: data.subject,
            content: data.content,
            sent_by: data.sentBy,
            response_required: data.responseRequired || false,
            response_received: false
        });

        // Update last contact date
        client.last_contact_date = new Date();
        client.updated_at = new Date();

        await client.save();
        return client;
    };

    const getPreferredMethod = async (clientId: string): Promise<string> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            throw new Error('Client not found');
        }
        return client.communication_preferences?.preferred_method || 'email';
    };

    const canSendMarketing = async (clientId: string): Promise<boolean> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            return false;
        }
        return client.communication_preferences?.marketing_opt_in && 
               client.privacy_settings?.marketing_consent &&
               client.status === 'active';
    };

    const scheduleBirthdayGreeting = async (clientId: string): Promise<any> => {
        const client = await clientSchema.findById(clientId);
        if (!client || !client.date_of_birth) {
            throw new Error('Client not found or no birth date available');
        }

        const birthDate = moment(client.date_of_birth);
        const thisYear = moment().year();
        const upcomingBirthday = birthDate.clone().year(thisYear);
        
        if (upcomingBirthday.isBefore(moment())) {
            upcomingBirthday.add(1, 'year');
        }

        return {
            client_id: clientId,
            client_name: `${client.first_name} ${client.last_name}`,
            birthday: upcomingBirthday.format('YYYY-MM-DD'),
            days_until_birthday: upcomingBirthday.diff(moment(), 'days'),
            preferred_method: client.communication_preferences?.preferred_method || 'email',
            vip_level: client.vip_services?.vip_level || 'bronze',
            special_requests: client.travel_preferences?.special_requests || ''
        };
    };

    const getInactiveClientsForFollowup = async (days: number = 30): Promise<any> => {
        const cutoffDate = moment().subtract(days, 'days').toDate();
        
        const clients = await clientSchema.find({
            deleted: 0,
            status: 'active',
            $or: [
                { last_contact_date: { $lt: cutoffDate } },
                { last_contact_date: { $exists: false } }
            ]
        }).select('client_id first_name last_name company_name email phone last_contact_date assigned_account_manager communication_preferences.preferred_method vip_services.is_vip');

        return clients.map(client => ({
            client_id: client.client_id,
            display_name: client.company_name || `${client.first_name} ${client.last_name}`,
            email: client.email,
            phone: client.phone,
            last_contact: client.last_contact_date,
            days_since_contact: client.last_contact_date ? 
                moment().diff(moment(client.last_contact_date), 'days') : null,
            assigned_manager: client.assigned_account_manager,
            preferred_method: client.communication_preferences?.preferred_method || 'email',
            is_vip: client.vip_services?.is_vip || false,
            priority: client.vip_services?.is_vip ? 'high' : 'medium'
        }));
    };

    const sendBookingConfirmation = async (clientId: string, bookingDetails: any): Promise<any> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        // Check if client wants booking confirmations
        const wantsNotification = client.communication_preferences?.notifications?.booking_confirmations;
        if (!wantsNotification) {
            return { message: 'Client has opted out of booking confirmations' };
        }

        const preferredMethod = client.communication_preferences?.preferred_method || 'email';
        const subject = `Booking Confirmation - ${bookingDetails.flight_number || 'Private Flight'}`;
        const content = generateBookingConfirmationContent(client, bookingDetails);

        // Record the communication
        await recordCommunication({
            clientId,
            method: preferredMethod as any,
            subject,
            content,
            sentBy: 'system',
            responseRequired: false
        });

        return {
            client_id: clientId,
            method: preferredMethod,
            subject,
            content,
            sent_at: new Date()
        };
    };

    const sendFlightUpdate = async (clientId: string, flightDetails: any): Promise<any> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        // Check if client wants flight updates
        const wantsNotification = client.communication_preferences?.notifications?.flight_updates;
        if (!wantsNotification) {
            return { message: 'Client has opted out of flight updates' };
        }

        const preferredMethod = client.communication_preferences?.preferred_method || 'email';
        const subject = `Flight Update - ${flightDetails.flight_number || 'Your Flight'}`;
        const content = generateFlightUpdateContent(client, flightDetails);

        // Record the communication
        await recordCommunication({
            clientId,
            method: preferredMethod as any,
            subject,
            content,
            sentBy: 'system',
            responseRequired: false
        });

        return {
            client_id: clientId,
            method: preferredMethod,
            subject,
            content,
            sent_at: new Date()
        };
    };

    const generateClientReport = async (clientId: string): Promise<any> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        const communicationHistory = client.communication_preferences?.communication_history || [];
        const recentCommunications = communicationHistory
            .filter(comm => moment(comm.date).isAfter(moment().subtract(90, 'days')))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const pendingResponses = communicationHistory
            .filter(comm => comm.response_required && !comm.response_received);

        return {
            client_summary: {
                id: client._id,
                client_id: client.client_id,
                display_name: client.company_name || `${client.first_name} ${client.last_name}`,
                email: client.email,
                phone: client.phone,
                status: client.status,
                client_type: client.client_type,
                vip_level: client.vip_services?.vip_level || 'bronze',
                assigned_manager: client.assigned_account_manager
            },
            communication_stats: {
                total_communications: communicationHistory.length,
                recent_communications: recentCommunications.length,
                pending_responses: pendingResponses.length,
                last_contact: client.last_contact_date,
                preferred_method: client.communication_preferences?.preferred_method || 'email',
                language: client.communication_preferences?.language || 'en',
                timezone: client.communication_preferences?.timezone || 'UTC'
            },
            preferences: {
                travel_preferences: client.travel_preferences,
                notification_preferences: client.communication_preferences?.notifications,
                marketing_consent: client.privacy_settings?.marketing_consent || false
            },
            recent_communications: recentCommunications.slice(0, 10),
            pending_responses: pendingResponses,
            flight_statistics: client.flight_statistics
        };
    };

    const getClientPreferences = async (clientId: string): Promise<any> => {
        const client = await clientSchema.findById(clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        return {
            travel_preferences: client.travel_preferences,
            communication_preferences: client.communication_preferences,
            vip_services: client.vip_services,
            privacy_settings: client.privacy_settings
        };
    };

    const updateCommunicationPreferences = async (clientId: string, preferences: any): Promise<any> => {
        const client = await clientSchema.findByIdAndUpdate(
            clientId,
            { 
                $set: { 
                    'communication_preferences.preferred_method': preferences.preferred_method,
                    'communication_preferences.language': preferences.language,
                    'communication_preferences.timezone': preferences.timezone,
                    'communication_preferences.marketing_opt_in': preferences.marketing_opt_in,
                    'communication_preferences.notifications': preferences.notifications,
                    'updated_at': new Date()
                }
            },
            { new: true }
        );

        if (!client) {
            throw new Error('Client not found');
        }

        return client;
    };

    return {
        recordCommunication,
        getPreferredMethod,
        canSendMarketing,
        scheduleBirthdayGreeting,
        getInactiveClientsForFollowup,
        sendBookingConfirmation,
        sendFlightUpdate,
        generateClientReport,
        getClientPreferences,
        updateCommunicationPreferences
    };
};

// Helper functions for generating content
const generateBookingConfirmationContent = (client: any, bookingDetails: any): string => {
    const clientName = client.first_name || client.contact_person;
    return `
Dear ${clientName},

Your booking has been confirmed!

Flight Details:
- Flight: ${bookingDetails.flight_number || 'Private Charter'}
- Date: ${bookingDetails.departure_date}
- Time: ${bookingDetails.departure_time}
- From: ${bookingDetails.departure_airport}
- To: ${bookingDetails.arrival_airport}
- Aircraft: ${bookingDetails.aircraft_type}

Booking Reference: ${bookingDetails.booking_reference}

Thank you for choosing our services.

Best regards,
Your Aviation Team
    `.trim();
};

const generateFlightUpdateContent = (client: any, flightDetails: any): string => {
    const clientName = client.first_name || client.contact_person;
    return `
Dear ${clientName},

Flight Update for ${flightDetails.flight_number || 'Your Flight'}:

${flightDetails.update_message}

Current Status: ${flightDetails.status}
${flightDetails.new_departure_time ? `New Departure Time: ${flightDetails.new_departure_time}` : ''}
${flightDetails.delay_reason ? `Reason: ${flightDetails.delay_reason}` : ''}

We apologize for any inconvenience and appreciate your patience.

Best regards,
Your Aviation Team
    `.trim();
};

export default createClientCommunicationService;