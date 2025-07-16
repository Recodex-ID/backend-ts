import clientSchema from '../schema/client';
import { Model, ObjectId } from 'mongoose';
import { reqPaging } from './utils';
import moment from 'moment';

export interface ClientData {
    client_id?: string;
    company_name?: string;
    contact_person: string;
    email: string;
    phone: string;
    title?: string;
    first_name: string;
    last_name: string;
    date_of_birth?: Date;
    nationality?: string;
    passport_number?: string;
    passport_expiry?: Date;
    billing_address?: any;
    shipping_address?: any;
    emergency_contacts?: any[];
    travel_preferences?: any;
    vip_services?: any;
    communication_preferences?: any;
    billing_info?: any;
    status?: string;
    client_type?: string;
    client_source?: string;
    assigned_account_manager?: ObjectId;
    privacy_settings?: any;
    notes?: any[];
    created_by?: ObjectId;
}

export interface ClientSearchFilters {
    search?: string;
    status?: string;
    client_type?: string;
    vip_level?: string;
    assigned_account_manager?: string;
    created_from?: string;
    created_to?: string;
    last_contact_from?: string;
    last_contact_to?: string;
}

type ClientInsertFunc = (data: ClientData, createdBy: string) => Promise<any>;
type ClientUpdateFunc = (data: any, id: string, updatedBy: string) => Promise<any>;
type ClientDeleteFunc = (id: string, deletedBy: string) => Promise<any>;
type ClientSearchFunc = (filters: ClientSearchFilters, page?: number, perPage?: number) => Promise<any>;
type ClientDetailFunc = (id: string) => Promise<any>;
type ClientNotesFunc = (id: string, note: string, category: string, priority: string, addedBy: string, isPrivate: boolean) => Promise<any>;
type ClientStatsFunc = (id: string) => Promise<any>;

export interface ClientInterface {
    insert: ClientInsertFunc;
    update: ClientUpdateFunc;
    delete: ClientDeleteFunc;
    search: ClientSearchFunc;
    getDetail: ClientDetailFunc;
    addNote: ClientNotesFunc;
    getStats: ClientStatsFunc;
    updateContactDate: (id: string) => Promise<any>;
    getVipClients: (vipLevel?: string) => Promise<any>;
    getClientsByManager: (managerId: string) => Promise<any>;
    generateClientId: () => string;
    validateEmail: (email: string, excludeId?: string) => Promise<boolean>;
    getBirthdayClients: (month?: number) => Promise<any>;
    getInactiveClients: (days?: number) => Promise<any>;
}

export default (): ClientInterface => {
    const generateClientId = (): string => {
        const year = moment().format('YYYY');
        const timestamp = moment().format('MMDDHHmmss');
        return `CL${year}${timestamp}`;
    };

    const validateEmail = async (email: string, excludeId?: string): Promise<boolean> => {
        const query: any = { email, deleted: 0 };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const existing = await clientSchema.findOne(query);
        return !existing;
    };

    const insert: ClientInsertFunc = async (data: ClientData, createdBy: string) => {
        // Generate client ID if not provided
        if (!data.client_id) {
            data.client_id = generateClientId();
        }

        // Validate email uniqueness
        const isEmailUnique = await validateEmail(data.email);
        if (!isEmailUnique) {
            throw new Error('Email address already exists');
        }

        // Set default values
        const clientData = {
            ...data,
            created_by: createdBy,
            created_at: new Date(),
            updated_at: new Date(),
            last_contact_date: new Date()
        };

        const client = new clientSchema(clientData);
        await client.save();
        return client;
    };

    const update: ClientUpdateFunc = async (data: any, id: string, updatedBy: string) => {
        // Validate email uniqueness if email is being updated
        if (data.email) {
            const isEmailUnique = await validateEmail(data.email, id);
            if (!isEmailUnique) {
                throw new Error('Email address already exists');
            }
        }

        const updateData = {
            ...data,
            updated_at: new Date()
        };

        const client = await clientSchema.findOneAndUpdate(
            { _id: id, deleted: 0 },
            { $set: updateData },
            { new: true }
        );

        if (!client) {
            throw new Error('Client not found');
        }

        return client;
    };

    const deleteClient: ClientDeleteFunc = async (id: string, deletedBy: string) => {
        const client = await clientSchema.findOneAndUpdate(
            { _id: id, deleted: 0 },
            { 
                $set: { 
                    deleted: 1,
                    deleted_by: deletedBy,
                    deleted_at: new Date()
                }
            },
            { new: true }
        );

        if (!client) {
            throw new Error('Client not found');
        }

        return client;
    };

    const search: ClientSearchFunc = async (filters: ClientSearchFilters, page = 1, perPage = 10) => {
        const query: any = { deleted: 0 };

        // Text search
        if (filters.search) {
            query.$text = { $search: filters.search };
        }

        // Status filter
        if (filters.status) {
            query.status = filters.status;
        }

        // Client type filter
        if (filters.client_type) {
            query.client_type = filters.client_type;
        }

        // VIP level filter
        if (filters.vip_level) {
            query['vip_services.vip_level'] = filters.vip_level;
        }

        // Account manager filter
        if (filters.assigned_account_manager) {
            query.assigned_account_manager = filters.assigned_account_manager;
        }

        // Date range filters
        if (filters.created_from || filters.created_to) {
            query.created_at = {};
            if (filters.created_from) {
                query.created_at.$gte = new Date(filters.created_from);
            }
            if (filters.created_to) {
                query.created_at.$lte = new Date(filters.created_to);
            }
        }

        if (filters.last_contact_from || filters.last_contact_to) {
            query.last_contact_date = {};
            if (filters.last_contact_from) {
                query.last_contact_date.$gte = new Date(filters.last_contact_from);
            }
            if (filters.last_contact_to) {
                query.last_contact_date.$lte = new Date(filters.last_contact_to);
            }
        }

        const sort = filters.search ? { score: { $meta: 'textScore' } } : { created_at: -1 };
        
        return await reqPaging(clientSchema, page, perPage, query, sort);
    };

    const getDetail: ClientDetailFunc = async (id: string) => {
        const client = await clientSchema.findOne({ _id: id, deleted: 0 });
        if (!client) {
            throw new Error('Client not found');
        }
        return client;
    };

    const addNote: ClientNotesFunc = async (id: string, note: string, category: string, priority: string, addedBy: string, isPrivate: boolean = false) => {
        const client = await clientSchema.findOne({ _id: id, deleted: 0 });
        if (!client) {
            throw new Error('Client not found');
        }

        client.notes.push({
            note,
            category,
            priority,
            added_by: addedBy,
            is_private: isPrivate,
            date: new Date()
        });

        await client.save();
        return client;
    };

    const getStats: ClientStatsFunc = async (id: string) => {
        const client = await clientSchema.findOne({ _id: id, deleted: 0 });
        if (!client) {
            throw new Error('Client not found');
        }

        // Calculate additional stats
        const totalNotes = client.notes.length;
        const emergencyContacts = client.emergency_contacts.length;
        const paymentMethods = client.billing_info?.payment_methods?.length || 0;
        const communicationHistory = client.communication_preferences?.communication_history?.length || 0;

        return {
            client_info: {
                id: client._id,
                client_id: client.client_id,
                full_name: `${client.first_name} ${client.last_name}`,
                display_name: client.company_name || `${client.first_name} ${client.last_name}`,
                status: client.status,
                client_type: client.client_type,
                vip_level: client.vip_services?.vip_level || 'bronze',
                is_vip: client.vip_services?.is_vip || false
            },
            flight_statistics: client.flight_statistics,
            activity_stats: {
                total_notes: totalNotes,
                emergency_contacts: emergencyContacts,
                payment_methods: paymentMethods,
                communication_history: communicationHistory,
                last_contact: client.last_contact_date,
                next_follow_up: client.next_follow_up,
                days_since_last_contact: client.last_contact_date ? 
                    moment().diff(moment(client.last_contact_date), 'days') : null
            },
            preferences: {
                travel_preferences: client.travel_preferences,
                communication_preferences: client.communication_preferences?.preferred_method,
                vip_services: client.vip_services
            }
        };
    };

    const updateContactDate = async (id: string) => {
        const client = await clientSchema.findOneAndUpdate(
            { _id: id, deleted: 0 },
            { 
                $set: { 
                    last_contact_date: new Date(),
                    updated_at: new Date()
                }
            },
            { new: true }
        );

        if (!client) {
            throw new Error('Client not found');
        }

        return client;
    };

    const getVipClients = async (vipLevel?: string) => {
        const query: any = { 
            deleted: 0,
            'vip_services.is_vip': true
        };

        if (vipLevel) {
            query['vip_services.vip_level'] = vipLevel;
        }

        return await clientSchema.find(query)
            .sort({ 'vip_services.vip_level': 1, last_contact_date: -1 });
    };

    const getClientsByManager = async (managerId: string) => {
        return await clientSchema.find({ 
            assigned_account_manager: managerId,
            deleted: 0 
        }).sort({ last_contact_date: -1 });
    };

    const getBirthdayClients = async (month?: number) => {
        const targetMonth = month || moment().month() + 1; // moment().month() is 0-based
        
        return await clientSchema.find({
            deleted: 0,
            date_of_birth: { $exists: true },
            $expr: {
                $eq: [{ $month: '$date_of_birth' }, targetMonth]
            }
        }).sort({ date_of_birth: 1 });
    };

    const getInactiveClients = async (days: number = 30) => {
        const cutoffDate = moment().subtract(days, 'days').toDate();
        
        return await clientSchema.find({
            deleted: 0,
            status: 'active',
            $or: [
                { last_contact_date: { $lt: cutoffDate } },
                { last_contact_date: { $exists: false } }
            ]
        }).sort({ last_contact_date: 1 });
    };

    return {
        insert,
        update,
        delete: deleteClient,
        search,
        getDetail,
        addNote,
        getStats,
        updateContactDate,
        getVipClients,
        getClientsByManager,
        generateClientId,
        validateEmail,
        getBirthdayClients,
        getInactiveClients
    };
};