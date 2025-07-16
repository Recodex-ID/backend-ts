import aircraftSchema from '../schema/aircraft';
import { createLog } from '../library/utils';
import moment from 'moment';
import { Types, ObjectId } from 'mongoose';

export interface AircraftSearchParams {
    aircraft_type?: string;
    manufacturer?: string;
    model?: string;
    current_status?: string;
    max_passengers?: number;
    available_for_charter?: boolean;
    base_location?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AircraftFilter {
    deleted: number;
    aircraft_type?: string;
    manufacturer?: string;
    model?: string;
    current_status?: string;
    'specifications.max_passengers'?: { $gte?: number; $lte?: number };
    'scheduling_info.available_for_charter'?: boolean;
    'scheduling_info.base_location'?: string;
    $text?: { $search: string };
}

export interface MaintenanceSchedule {
    aircraft_id: string;
    registration: string;
    display_name: string;
    inspection_type: string;
    due_date: Date;
    total_hours: number;
    hours_since_inspection: number;
    maintenance_provider: string;
    priority: string;
}

export interface AircraftAvailability {
    aircraft_id: string;
    registration: string;
    display_name: string;
    available_periods: Array<{
        start_date: Date;
        end_date: Date;
        location: string;
    }>;
    blocked_periods: Array<{
        start_date: Date;
        end_date: Date;
        reason: string;
    }>;
}

export interface AircraftModel {
    // Basic CRUD operations
    createAircraft: (aircraftData: any, createdBy: string | ObjectId) => Promise<any>;
    updateAircraft: (aircraftId: string, updateData: any, updatedBy: string | ObjectId) => Promise<any>;
    deleteAircraft: (aircraftId: string, deletedBy: string | ObjectId) => Promise<any>;
    getAircraftById: (aircraftId: string) => Promise<any>;
    getAircraftByRegistration: (registration: string) => Promise<any>;
    
    // Search and filtering
    searchAircraft: (params: AircraftSearchParams) => Promise<any>;
    getAircraftByType: (aircraftType: string, limit?: number) => Promise<any>;
    getAircraftByStatus: (status: string, limit?: number) => Promise<any>;
    getAircraftByManufacturer: (manufacturer: string, limit?: number) => Promise<any>;
    
    // Availability and scheduling
    getAvailableAircraft: (startDate: Date, endDate: Date, location?: string) => Promise<any>;
    updateAircraftLocation: (aircraftId: string, location: any, updatedBy: string | ObjectId) => Promise<any>;
    updateAircraftStatus: (aircraftId: string, status: string, updatedBy: string | ObjectId) => Promise<any>;
    addBlockedDate: (aircraftId: string, blockData: any, updatedBy: string | ObjectId) => Promise<any>;
    removeBlockedDate: (aircraftId: string, blockId: string, updatedBy: string | ObjectId) => Promise<any>;
    
    // Maintenance management
    getMaintenanceSchedule: (daysAhead?: number) => Promise<MaintenanceSchedule[]>;
    updateMaintenanceInfo: (aircraftId: string, maintenanceData: any, updatedBy: string | ObjectId) => Promise<any>;
    getAircraftDueForMaintenance: (daysAhead?: number) => Promise<any>;
    
    // Fleet analytics
    getFleetStatistics: () => Promise<any>;
    getAircraftUtilization: (aircraftId?: string, months?: number) => Promise<any>;
    getOperatingCostsReport: (aircraftId?: string, period?: string) => Promise<any>;
    
    // Specialized queries
    getAircraftByCapacity: (minPassengers: number, maxPassengers: number) => Promise<any>;
    getAircraftByRange: (minRange: number, maxRange: number) => Promise<any>;
    getNearestAircraft: (airportCode: string, maxDistance?: number) => Promise<any>;
    
    // Notes and history
    addAircraftNote: (aircraftId: string, note: string, category: string, priority: string, addedBy: string | ObjectId) => Promise<any>;
    getAircraftHistory: (aircraftId: string, limit?: number) => Promise<any>;
    
    // Validation and utility
    validateAircraftData: (aircraftData: any) => Promise<any>;
    generateAircraftReport: (aircraftId: string) => Promise<any>;
}

export const createAircraftModel = (): AircraftModel => {
    
    // Helper function to convert string to ObjectId
    const toObjectId = (id: string | ObjectId): any => {
        return typeof id === 'string' ? new Types.ObjectId(id) : id;
    };
    
    const createAircraft = async (aircraftData: any, createdBy: string | ObjectId): Promise<any> => {
        // Validate required fields
        const requiredFields = ['aircraft_id', 'registration', 'manufacturer', 'model', 'aircraft_type', 'year_manufactured', 'serial_number'];
        const missingFields = requiredFields.filter(field => !aircraftData[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check for existing aircraft with same registration or aircraft_id
        const existingAircraft = await aircraftSchema.findOne({
            $or: [
                { aircraft_id: aircraftData.aircraft_id },
                { registration: aircraftData.registration }
            ],
            deleted: 0
        });

        if (existingAircraft) {
            throw new Error('Aircraft with this ID or registration already exists');
        }

        // Set default values
        const aircraftToCreate = {
            ...aircraftData,
            created_by: toObjectId(createdBy) as any,
            created_at: new Date(),
            updated_at: new Date(),
            deleted: 0
        };

        // Ensure required nested fields have defaults
        if (!aircraftToCreate.specifications) {
            aircraftToCreate.specifications = {};
        }
        if (!aircraftToCreate.current_location) {
            aircraftToCreate.current_location = {
                airport_code: aircraftData.base_location || 'TBD',
                updated_at: new Date()
            };
        }
        if (!aircraftToCreate.scheduling_info) {
            aircraftToCreate.scheduling_info = {
                base_location: aircraftData.base_location || 'TBD',
                available_for_charter: true,
                minimum_booking_notice: 24,
                maximum_booking_advance: 365,
                blocked_dates: []
            };
        }

        const aircraft = new aircraftSchema(aircraftToCreate);
        const savedAircraft = await aircraft.save();

        // Log creation
        createLog(toObjectId(createdBy), `Aircraft ${savedAircraft.registration} created`, { url: '/aircraft', method: 'POST' } as any);

        return savedAircraft;
    };

    const updateAircraft = async (aircraftId: string, updateData: any, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        // Prevent updating system fields
        const systemFields = ['_id', 'aircraft_id', 'created_by', 'created_at', 'deleted', 'deleted_by', 'deleted_at'];
        systemFields.forEach(field => delete updateData[field]);

        // Update fields
        Object.assign(aircraft, updateData);
        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log update
        createLog(toObjectId(updatedBy), `Aircraft ${aircraft.registration} updated`, { url: '/aircraft', method: 'PUT' } as any);

        return updatedAircraft;
    };

    const deleteAircraft = async (aircraftId: string, deletedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        // Soft delete
        aircraft.deleted = Date.now();
        aircraft.deleted_by = toObjectId(deletedBy) as any;
        aircraft.deleted_at = new Date();
        aircraft.updated_at = new Date();

        const deletedAircraft = await aircraft.save();

        // Log deletion
        createLog(toObjectId(deletedBy), `Aircraft ${aircraft.registration} deleted`, { url: '/aircraft', method: 'DELETE' } as any);

        return deletedAircraft;
    };

    const getAircraftById = async (aircraftId: string): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }
        return aircraft;
    };

    const getAircraftByRegistration = async (registration: string): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ registration: registration, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }
        return aircraft;
    };

    const searchAircraft = async (params: AircraftSearchParams): Promise<any> => {
        const {
            aircraft_type,
            manufacturer,
            model,
            current_status,
            max_passengers,
            available_for_charter,
            base_location,
            search,
            page = 1,
            limit = 20
        } = params;

        const filter: AircraftFilter = { deleted: 0 };

        // Build filter conditions
        if (aircraft_type) filter.aircraft_type = aircraft_type;
        if (manufacturer) filter.manufacturer = manufacturer;
        if (model) filter.model = model;
        if (current_status) filter.current_status = current_status;
        if (max_passengers) filter['specifications.max_passengers'] = { $gte: max_passengers };
        if (available_for_charter !== undefined) filter['scheduling_info.available_for_charter'] = available_for_charter;
        if (base_location) filter['scheduling_info.base_location'] = base_location;
        if (search) filter.$text = { $search: search };

        const skip = (page - 1) * limit;

        const aircraft = await aircraftSchema
            .find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const totalCount = await aircraftSchema.countDocuments(filter);

        return {
            aircraft,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: limit
            }
        };
    };

    const getAircraftByType = async (aircraftType: string, limit: number = 50): Promise<any> => {
        return await aircraftSchema
            .find({ aircraft_type: aircraftType, deleted: 0 })
            .sort({ manufacturer: 1, model: 1 })
            .limit(limit);
    };

    const getAircraftByStatus = async (status: string, limit: number = 50): Promise<any> => {
        return await aircraftSchema
            .find({ current_status: status, deleted: 0 })
            .sort({ updated_at: -1 })
            .limit(limit);
    };

    const getAircraftByManufacturer = async (manufacturer: string, limit: number = 50): Promise<any> => {
        return await aircraftSchema
            .find({ manufacturer: manufacturer, deleted: 0 })
            .sort({ model: 1, year_manufactured: -1 })
            .limit(limit);
    };

    const getAvailableAircraft = async (startDate: Date, endDate: Date, location?: string): Promise<any> => {
        const filter: any = {
            deleted: 0,
            current_status: { $in: ['available', 'scheduled'] },
            'scheduling_info.available_for_charter': true
        };

        if (location) {
            filter['scheduling_info.base_location'] = location;
        }

        const aircraft = await aircraftSchema.find(filter);

        // Filter out aircraft with blocked dates that conflict with requested period
        const availableAircraft = aircraft.filter(aircraft => {
            const blockedDates = aircraft.scheduling_info?.blocked_dates || [];
            
            return !blockedDates.some(blocked => {
                const blockStart = new Date(blocked.start_date);
                const blockEnd = new Date(blocked.end_date);
                
                // Check if requested period overlaps with blocked period
                return (startDate <= blockEnd && endDate >= blockStart);
            });
        });

        return availableAircraft.map(aircraft => ({
            aircraft_id: aircraft.aircraft_id,
            registration: aircraft.registration,
            display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`,
            aircraft_type: aircraft.aircraft_type,
            specifications: aircraft.specifications,
            current_location: aircraft.current_location,
            base_location: aircraft.scheduling_info?.base_location,
            operating_costs: aircraft.operating_costs,
            interior_configuration: aircraft.interior_configuration
        }));
    };

    const updateAircraftLocation = async (aircraftId: string, location: any, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        aircraft.current_location = {
            airport_code: location.airport_code,
            airport_name: location.airport_name || '',
            city: location.city || '',
            country: location.country || '',
            updated_at: new Date()
        };
        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log location update
        createLog(toObjectId(updatedBy), `Aircraft ${aircraft.registration} location updated to ${location.airport_code}`, { url: '/aircraft', method: 'PUT' } as any);

        return updatedAircraft;
    };

    const updateAircraftStatus = async (aircraftId: string, status: string, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        const previousStatus = aircraft.current_status;
        aircraft.current_status = status as any;
        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log status update
        createLog(toObjectId(updatedBy), `Aircraft ${aircraft.registration} status changed from ${previousStatus} to ${status}`, { url: '/aircraft', method: 'PUT' } as any);

        return updatedAircraft;
    };

    const addBlockedDate = async (aircraftId: string, blockData: any, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        if (!aircraft.scheduling_info) {
            aircraft.scheduling_info = {
                base_location: 'TBD',
                available_for_charter: true,
                minimum_booking_notice: 24,
                maximum_booking_advance: 365,
                blocked_dates: [] as any,
                preferred_routes: [],
                restricted_airports: []
            };
        }

        if (!aircraft.scheduling_info.blocked_dates) {
            aircraft.scheduling_info.blocked_dates = [] as any;
        }

        aircraft.scheduling_info.blocked_dates.push({
            start_date: blockData.start_date,
            end_date: blockData.end_date,
            reason: blockData.reason || 'other',
            notes: blockData.notes || ''
        });

        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log blocked date addition
        createLog(toObjectId(updatedBy), `Blocked date added for aircraft ${aircraft.registration}`, { url: '/aircraft', method: 'POST' } as any);

        return updatedAircraft;
    };

    const removeBlockedDate = async (aircraftId: string, blockId: string, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        if (aircraft.scheduling_info?.blocked_dates) {
            const blockedDates = aircraft.scheduling_info.blocked_dates.filter(
                (block: any) => block._id.toString() !== blockId
            );
            aircraft.scheduling_info.blocked_dates = blockedDates as any;
        }

        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log blocked date removal
        createLog(toObjectId(updatedBy), `Blocked date removed for aircraft ${aircraft.registration}`, { url: '/aircraft', method: 'DELETE' } as any);

        return updatedAircraft;
    };

    const getMaintenanceSchedule = async (daysAhead: number = 90): Promise<MaintenanceSchedule[]> => {
        const cutoffDate = moment().add(daysAhead, 'days').toDate();
        
        const aircraft = await aircraftSchema.find({
            deleted: 0,
            'maintenance_info.next_inspection_due': { $lte: cutoffDate }
        }).sort({ 'maintenance_info.next_inspection_due': 1 });

        return aircraft.map(aircraft => ({
            aircraft_id: aircraft.aircraft_id,
            registration: aircraft.registration,
            display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`,
            inspection_type: aircraft.maintenance_info?.inspection_type || 'annual',
            due_date: aircraft.maintenance_info?.next_inspection_due,
            total_hours: aircraft.maintenance_info?.total_flight_hours || 0,
            hours_since_inspection: aircraft.maintenance_info?.hours_since_last_inspection || 0,
            maintenance_provider: aircraft.maintenance_info?.maintenance_provider || '',
            priority: moment(aircraft.maintenance_info?.next_inspection_due).isBefore(moment().add(30, 'days')) ? 'high' : 'medium'
        }));
    };

    const updateMaintenanceInfo = async (aircraftId: string, maintenanceData: any, updatedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        if (!aircraft.maintenance_info) {
            aircraft.maintenance_info = {
                total_flight_hours: 0,
                inspection_type: 'annual',
                total_cycles: 0,
                hours_since_last_inspection: 0,
                maintenance_provider: '',
                maintenance_location: '',
                maintenance_notes: []
            };
        }

        Object.assign(aircraft.maintenance_info, maintenanceData);
        aircraft.updated_at = new Date();
        aircraft.last_updated_by = toObjectId(updatedBy) as any;

        const updatedAircraft = await aircraft.save();

        // Log maintenance update
        createLog(toObjectId(updatedBy), `Maintenance info updated for aircraft ${aircraft.registration}`, { url: '/aircraft', method: 'PUT' } as any);

        return updatedAircraft;
    };

    const getAircraftDueForMaintenance = async (daysAhead: number = 30): Promise<any> => {
        const cutoffDate = moment().add(daysAhead, 'days').toDate();
        
        return await aircraftSchema.find({
            deleted: 0,
            'maintenance_info.next_inspection_due': { $lte: cutoffDate }
        }).sort({ 'maintenance_info.next_inspection_due': 1 });
    };

    const getFleetStatistics = async (): Promise<any> => {
        const totalAircraft = await aircraftSchema.countDocuments({ deleted: 0 });
        
        const statusCounts = await aircraftSchema.aggregate([
            { $match: { deleted: 0 } },
            { $group: { _id: '$current_status', count: { $sum: 1 } } }
        ]);

        const typeCounts = await aircraftSchema.aggregate([
            { $match: { deleted: 0 } },
            { $group: { _id: '$aircraft_type', count: { $sum: 1 } } }
        ]);

        const manufacturerCounts = await aircraftSchema.aggregate([
            { $match: { deleted: 0 } },
            { $group: { _id: '$manufacturer', count: { $sum: 1 } } }
        ]);

        const averageAge = await aircraftSchema.aggregate([
            { $match: { deleted: 0 } },
            { $group: { _id: null, avgAge: { $avg: { $subtract: [new Date().getFullYear(), '$year_manufactured'] } } } }
        ]);

        const totalCapacity = await aircraftSchema.aggregate([
            { $match: { deleted: 0 } },
            { $group: { _id: null, totalSeats: { $sum: '$specifications.max_passengers' } } }
        ]);

        return {
            total_aircraft: totalAircraft,
            status_distribution: statusCounts,
            type_distribution: typeCounts,
            manufacturer_distribution: manufacturerCounts,
            average_age: averageAge[0]?.avgAge || 0,
            total_capacity: totalCapacity[0]?.totalSeats || 0,
            utilization_stats: {
                available_for_charter: await aircraftSchema.countDocuments({ 
                    deleted: 0, 
                    'scheduling_info.available_for_charter': true 
                }),
                in_maintenance: await aircraftSchema.countDocuments({ 
                    deleted: 0, 
                    current_status: 'maintenance' 
                }),
                out_of_service: await aircraftSchema.countDocuments({ 
                    deleted: 0, 
                    current_status: 'out_of_service' 
                })
            }
        };
    };

    const getAircraftUtilization = async (aircraftId?: string, months: number = 12): Promise<any> => {
        const filter: any = { deleted: 0 };
        if (aircraftId) filter.aircraft_id = aircraftId;

        const aircraft = await aircraftSchema.find(filter);

        return aircraft.map(aircraft => ({
            aircraft_id: aircraft.aircraft_id,
            registration: aircraft.registration,
            display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`,
            total_hours: aircraft.flight_statistics?.total_flight_hours || 0,
            total_flights: aircraft.flight_statistics?.total_flights || 0,
            average_utilization: aircraft.flight_statistics?.average_utilization || 0,
            last_flight: aircraft.flight_statistics?.last_flight_date,
            maintenance_hours: aircraft.maintenance_info?.total_flight_hours || 0,
            hours_since_maintenance: aircraft.maintenance_info?.hours_since_last_inspection || 0,
            utilization_rate: aircraft.flight_statistics?.average_utilization ? 
                (aircraft.flight_statistics.average_utilization / 100) * 100 : 0
        }));
    };

    const getOperatingCostsReport = async (aircraftId?: string, period: string = 'monthly'): Promise<any> => {
        const filter: any = { deleted: 0 };
        if (aircraftId) filter.aircraft_id = aircraftId;

        const aircraft = await aircraftSchema.find(filter);

        return aircraft.map(aircraft => {
            const costs = aircraft.operating_costs || {};
            const stats = aircraft.flight_statistics || {};
            
            const monthlyHours = (stats as any).average_utilization || 0;
            const yearlyHours = monthlyHours * 12;
            
            return {
                aircraft_id: aircraft.aircraft_id,
                registration: aircraft.registration,
                display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`,
                hourly_costs: {
                    total_hourly_rate: aircraft.operating_costs?.hourly_rate || 0,
                    fuel_cost: (aircraft.operating_costs?.fuel_consumption || 0) * 5, // Assuming $5 per gallon
                    maintenance_cost: aircraft.operating_costs?.maintenance_cost_per_hour || 0,
                    crew_cost: aircraft.operating_costs?.crew_cost_per_hour || 0
                },
                monthly_costs: {
                    flight_costs: (aircraft.operating_costs?.hourly_rate || 0) * monthlyHours,
                    insurance: aircraft.operating_costs?.insurance_cost_monthly || 0,
                    hangar: aircraft.operating_costs?.hangar_cost_monthly || 0,
                    total_monthly: ((aircraft.operating_costs?.hourly_rate || 0) * monthlyHours) + 
                                 (aircraft.operating_costs?.insurance_cost_monthly || 0) + 
                                 (aircraft.operating_costs?.hangar_cost_monthly || 0)
                },
                yearly_costs: {
                    flight_costs: (aircraft.operating_costs?.hourly_rate || 0) * yearlyHours,
                    insurance: (aircraft.operating_costs?.insurance_cost_monthly || 0) * 12,
                    hangar: (aircraft.operating_costs?.hangar_cost_monthly || 0) * 12,
                    annual_inspection: aircraft.operating_costs?.annual_inspection_cost || 0,
                    total_yearly: ((aircraft.operating_costs?.hourly_rate || 0) * yearlyHours) + 
                                ((aircraft.operating_costs?.insurance_cost_monthly || 0) * 12) + 
                                ((aircraft.operating_costs?.hangar_cost_monthly || 0) * 12) + 
                                (aircraft.operating_costs?.annual_inspection_cost || 0)
                },
                utilization: {
                    monthly_hours: monthlyHours,
                    yearly_hours: yearlyHours,
                    cost_per_hour: aircraft.operating_costs?.hourly_rate || 0
                }
            };
        });
    };

    const getAircraftByCapacity = async (minPassengers: number, maxPassengers: number): Promise<any> => {
        return await aircraftSchema.find({
            deleted: 0,
            'specifications.max_passengers': { $gte: minPassengers, $lte: maxPassengers }
        }).sort({ 'specifications.max_passengers': 1 });
    };

    const getAircraftByRange = async (minRange: number, maxRange: number): Promise<any> => {
        return await aircraftSchema.find({
            deleted: 0,
            'specifications.max_range': { $gte: minRange, $lte: maxRange }
        }).sort({ 'specifications.max_range': -1 });
    };

    const getNearestAircraft = async (airportCode: string, maxDistance: number = 500): Promise<any> => {
        // This is a simplified version - in production, you'd use geospatial queries
        return await aircraftSchema.find({
            deleted: 0,
            current_status: { $in: ['available', 'scheduled'] },
            $or: [
                { 'current_location.airport_code': airportCode },
                { 'scheduling_info.base_location': airportCode }
            ]
        }).sort({ updated_at: -1 });
    };

    const addAircraftNote = async (aircraftId: string, note: string, category: string, priority: string, addedBy: string | ObjectId): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        aircraft.notes.push({
            date: new Date(),
            note,
            category,
            priority,
            added_by: toObjectId(addedBy) as any,
            is_private: false
        });

        aircraft.updated_at = new Date();
        const updatedAircraft = await aircraft.save();

        // Log note addition
        createLog(toObjectId(addedBy), `Note added to aircraft ${aircraft.registration}`, { url: '/aircraft', method: 'POST' } as any);

        return updatedAircraft;
    };

    const getAircraftHistory = async (aircraftId: string, limit: number = 50): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        return {
            aircraft_info: {
                aircraft_id: aircraft.aircraft_id,
                registration: aircraft.registration,
                display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`
            },
            notes: aircraft.notes
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, limit),
            maintenance_history: aircraft.maintenance_info?.maintenance_notes || [],
            flight_statistics: aircraft.flight_statistics,
            location_history: aircraft.current_location
        };
    };

    const validateAircraftData = async (aircraftData: any): Promise<any> => {
        const errors: string[] = [];

        // Required field validation
        const requiredFields = ['aircraft_id', 'registration', 'manufacturer', 'model', 'aircraft_type', 'year_manufactured', 'serial_number'];
        requiredFields.forEach(field => {
            if (!aircraftData[field]) {
                errors.push(`${field} is required`);
            }
        });

        // Business logic validation
        if (aircraftData.year_manufactured && aircraftData.year_manufactured > new Date().getFullYear()) {
            errors.push('Year manufactured cannot be in the future');
        }

        if (aircraftData.specifications?.max_passengers && aircraftData.specifications.max_passengers < 1) {
            errors.push('Maximum passengers must be at least 1');
        }

        if (aircraftData.specifications?.max_range && aircraftData.specifications.max_range < 0) {
            errors.push('Maximum range cannot be negative');
        }

        // Check for duplicate registration
        if (aircraftData.registration) {
            const existingAircraft = await aircraftSchema.findOne({
                registration: aircraftData.registration,
                deleted: 0
            });

            if (existingAircraft && existingAircraft.aircraft_id !== aircraftData.aircraft_id) {
                errors.push('Aircraft with this registration already exists');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    const generateAircraftReport = async (aircraftId: string): Promise<any> => {
        const aircraft = await aircraftSchema.findOne({ aircraft_id: aircraftId, deleted: 0 });
        if (!aircraft) {
            throw new Error('Aircraft not found');
        }

        const maintenanceSchedule = await getMaintenanceSchedule();
        const aircraftMaintenance = maintenanceSchedule.filter(m => m.aircraft_id === aircraftId);

        return {
            aircraft_summary: {
                aircraft_id: aircraft.aircraft_id,
                registration: aircraft.registration,
                display_name: `${aircraft.manufacturer} ${aircraft.model} (${aircraft.registration})`,
                manufacturer: aircraft.manufacturer,
                model: aircraft.model,
                aircraft_type: aircraft.aircraft_type,
                year_manufactured: aircraft.year_manufactured,
                current_status: aircraft.current_status,
                current_location: aircraft.current_location
            },
            specifications: aircraft.specifications,
            interior_configuration: aircraft.interior_configuration,
            operating_costs: aircraft.operating_costs,
            scheduling_info: aircraft.scheduling_info,
            maintenance_summary: {
                next_inspection_due: aircraft.maintenance_info?.next_inspection_due,
                total_flight_hours: aircraft.maintenance_info?.total_flight_hours || 0,
                hours_since_inspection: aircraft.maintenance_info?.hours_since_last_inspection || 0,
                maintenance_provider: aircraft.maintenance_info?.maintenance_provider || '',
                upcoming_maintenance: aircraftMaintenance
            },
            flight_statistics: aircraft.flight_statistics,
            performance_metrics: aircraft.performance_metrics,
            recent_notes: aircraft.notes
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10),
            created_info: {
                created_by: aircraft.created_by,
                created_at: aircraft.created_at,
                last_updated: aircraft.updated_at,
                last_updated_by: aircraft.last_updated_by
            }
        };
    };

    return {
        createAircraft,
        updateAircraft,
        deleteAircraft,
        getAircraftById,
        getAircraftByRegistration,
        searchAircraft,
        getAircraftByType,
        getAircraftByStatus,
        getAircraftByManufacturer,
        getAvailableAircraft,
        updateAircraftLocation,
        updateAircraftStatus,
        addBlockedDate,
        removeBlockedDate,
        getMaintenanceSchedule,
        updateMaintenanceInfo,
        getAircraftDueForMaintenance,
        getFleetStatistics,
        getAircraftUtilization,
        getOperatingCostsReport,
        getAircraftByCapacity,
        getAircraftByRange,
        getNearestAircraft,
        addAircraftNote,
        getAircraftHistory,
        validateAircraftData,
        generateAircraftReport
    };
};

export default createAircraftModel;