import populate from 'mongoose-autopopulate';
import m from 'mongoose';
const Schema = m.Schema;

const aircraftSchema = new Schema({
    // Basic Aircraft Information
    aircraft_id: { type: String, required: true },
    registration: { type: String, required: true }, // Aircraft registration number (e.g., N123AB)
    manufacturer: { type: String, required: true }, // Boeing, Airbus, Cessna, etc.
    model: { type: String, required: true }, // 737-800, A320, Citation X, etc.
    variant: { type: String, default: '' }, // Specific variant or sub-model
    year_manufactured: { type: Number, required: true },
    serial_number: { type: String, required: true },
    
    // Aircraft Classification
    aircraft_type: { 
        type: String, 
        enum: ['light_jet', 'midsize_jet', 'super_midsize', 'heavy_jet', 'ultra_long_range', 'turboprop', 'helicopter'], 
        required: true 
    },
    category: { 
        type: String, 
        enum: ['business_jet', 'commercial', 'cargo', 'charter', 'private'], 
        default: 'business_jet' 
    },
    
    // Technical Specifications
    specifications: {
        max_passengers: { type: Number, required: true },
        max_range: { type: Number, required: true }, // in nautical miles
        max_altitude: { type: Number, required: true }, // in feet
        cruise_speed: { type: Number, required: true }, // in knots
        fuel_capacity: { type: Number, required: true }, // in gallons
        baggage_capacity: { type: Number, required: true }, // in cubic feet
        runway_length_required: { type: Number, required: true }, // in feet
        wingspan: { type: Number, default: 0 }, // in feet
        length: { type: Number, default: 0 }, // in feet
        height: { type: Number, default: 0 }, // in feet
        max_takeoff_weight: { type: Number, default: 0 }, // in pounds
        engines: {
            type: { type: String, enum: ['turbofan', 'turboprop', 'piston'], default: 'turbofan' },
            count: { type: Number, default: 2 },
            manufacturer: { type: String, default: '' },
            model: { type: String, default: '' }
        }
    },
    
    // Interior Configuration
    interior_configuration: {
        seating_capacity: { type: Number, required: true },
        seating_layout: { type: String, default: '' }, // e.g., "2-2", "1-2-1"
        cabin_configuration: { type: String, enum: ['standard', 'vip', 'executive', 'luxury', 'custom'], default: 'standard' },
        amenities: [{
            type: { type: String, enum: ['wifi', 'entertainment', 'galley', 'lavatory', 'bedroom', 'conference', 'bar', 'shower'] },
            description: String,
            quantity: { type: Number, default: 1 }
        }],
        special_features: [{ type: String }],
        cabin_height: { type: Number, default: 0 }, // in feet
        cabin_width: { type: Number, default: 0 }, // in feet
        cabin_length: { type: Number, default: 0 } // in feet
    },
    
    // Current Status & Location
    current_status: { 
        type: String, 
        enum: ['available', 'in_flight', 'maintenance', 'scheduled', 'out_of_service', 'inspection'], 
        default: 'available' 
    },
    current_location: {
        airport_code: { type: String, required: true }, // ICAO or IATA code
        airport_name: { type: String, default: '' },
        city: { type: String, default: '' },
        country: { type: String, default: '' },
        updated_at: { type: Date, default: Date.now }
    },
    
    // Ownership & Management
    ownership_type: { 
        type: String, 
        enum: ['owned', 'leased', 'managed', 'partnership'], 
        default: 'owned' 
    },
    owner_information: {
        owner_name: { type: String, default: '' },
        owner_contact: { type: String, default: '' },
        lease_expiry: { type: Date },
        management_company: { type: String, default: '' }
    },
    
    // Operating Costs
    operating_costs: {
        hourly_rate: { type: Number, required: true }, // Cost per flight hour
        fuel_consumption: { type: Number, required: true }, // Gallons per hour
        maintenance_cost_per_hour: { type: Number, default: 0 },
        crew_cost_per_hour: { type: Number, default: 0 },
        insurance_cost_monthly: { type: Number, default: 0 },
        hangar_cost_monthly: { type: Number, default: 0 },
        annual_inspection_cost: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' }
    },
    
    // Maintenance Information
    maintenance_info: {
        last_inspection: { type: Date },
        next_inspection_due: { type: Date },
        inspection_type: { type: String, enum: ['100_hour', 'annual', 'progressive', 'hot_section', 'overhaul'], default: 'annual' },
        total_flight_hours: { type: Number, default: 0 },
        total_cycles: { type: Number, default: 0 },
        hours_since_last_inspection: { type: Number, default: 0 },
        maintenance_provider: { type: String, default: '' },
        maintenance_location: { type: String, default: '' },
        airworthiness_certificate: {
            certificate_number: { type: String, default: '' },
            expiry_date: { type: Date },
            issuing_authority: { type: String, default: '' }
        },
        maintenance_notes: [{ type: String }]
    },
    
    // Insurance & Certification
    insurance_info: {
        provider: { type: String, default: '' },
        policy_number: { type: String, default: '' },
        coverage_amount: { type: Number, default: 0 },
        expiry_date: { type: Date },
        deductible: { type: Number, default: 0 }
    },
    
    // Scheduling & Availability
    scheduling_info: {
        base_location: { type: String, required: true }, // Primary base airport
        available_for_charter: { type: Boolean, default: true },
        minimum_booking_notice: { type: Number, default: 24 }, // hours
        maximum_booking_advance: { type: Number, default: 365 }, // days
        blocked_dates: [{
            start_date: { type: Date, required: true },
            end_date: { type: Date, required: true },
            reason: { type: String, enum: ['maintenance', 'owner_use', 'inspection', 'seasonal', 'other'], default: 'other' },
            notes: String
        }],
        preferred_routes: [{ type: String }],
        restricted_airports: [{ type: String }]
    },
    
    // Flight History Summary
    flight_statistics: {
        total_flights: { type: Number, default: 0 },
        total_flight_hours: { type: Number, default: 0 },
        total_distance: { type: Number, default: 0 }, // in nautical miles
        average_utilization: { type: Number, default: 0 }, // hours per month
        last_flight_date: { type: Date },
        most_frequent_route: { type: String, default: '' },
        total_passengers_carried: { type: Number, default: 0 },
        fuel_consumed_total: { type: Number, default: 0 }
    },
    
    // Crew Requirements
    crew_requirements: {
        minimum_crew: { type: Number, default: 2 },
        captain_required: { type: Boolean, default: true },
        first_officer_required: { type: Boolean, default: true },
        flight_attendant_required: { type: Boolean, default: false },
        specific_certifications: [{ type: String }],
        preferred_crew_base: { type: String, default: '' }
    },
    
    // Documents & Compliance
    documents: {
        registration_certificate: {
            document_number: { type: String, default: '' },
            expiry_date: { type: Date },
            issuing_authority: { type: String, default: '' }
        },
        noise_certificate: {
            document_number: { type: String, default: '' },
            expiry_date: { type: Date },
            noise_level: { type: String, default: '' }
        },
        radio_license: {
            document_number: { type: String, default: '' },
            expiry_date: { type: Date },
            call_sign: { type: String, default: '' }
        },
        export_certificate: {
            document_number: { type: String, default: '' },
            expiry_date: { type: Date }
        }
    },
    
    // Performance Metrics
    performance_metrics: {
        reliability_score: { type: Number, default: 100 }, // 0-100
        punctuality_score: { type: Number, default: 100 }, // 0-100
        maintenance_incidents: { type: Number, default: 0 },
        flight_cancellations: { type: Number, default: 0 },
        customer_satisfaction: { type: Number, default: 5 } // 1-5
    },
    
    // Photos & Media
    media: {
        exterior_photos: [{ type: String }], // URLs to photos
        interior_photos: [{ type: String }], // URLs to photos
        specification_sheets: [{ type: String }], // URLs to documents
        virtual_tour_url: { type: String, default: '' }
    },
    
    // Notes & Comments
    notes: [{
        date: { type: Date, default: Date.now },
        note: { type: String, required: true },
        category: { type: String, enum: ['maintenance', 'operation', 'scheduling', 'performance', 'general'], default: 'general' },
        priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        added_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name' } },
        is_private: { type: Boolean, default: false }
    }],
    
    // System Fields
    created_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name email' } },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    last_updated_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name' } },
    
    // Soft Delete
    deleted: { type: Number, default: 0 },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name email' } },
    deleted_at: { type: Date }
});

// Indexes for performance
aircraftSchema.index({ aircraft_id: 1 }, { unique: true });
aircraftSchema.index({ registration: 1 }, { unique: true });
aircraftSchema.index({ manufacturer: 1, model: 1 });
aircraftSchema.index({ aircraft_type: 1 });
aircraftSchema.index({ current_status: 1 });
aircraftSchema.index({ 'current_location.airport_code': 1 });
aircraftSchema.index({ 'scheduling_info.base_location': 1 });
aircraftSchema.index({ 'scheduling_info.available_for_charter': 1 });
aircraftSchema.index({ 'maintenance_info.next_inspection_due': 1 });
aircraftSchema.index({ created_at: -1 });

// Text search index
aircraftSchema.index({
    aircraft_id: 'text',
    registration: 'text',
    manufacturer: 'text',
    model: 'text',
    variant: 'text',
    serial_number: 'text'
});

// Compound indexes for common queries
aircraftSchema.index({ aircraft_type: 1, current_status: 1 });
aircraftSchema.index({ 'scheduling_info.available_for_charter': 1, current_status: 1 });
aircraftSchema.index({ manufacturer: 1, model: 1, year_manufactured: 1 });

// Plugins
aircraftSchema.plugin(populate);

// Pre-save middleware
aircraftSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Virtual fields
aircraftSchema.virtual('display_name').get(function() {
    return `${this.manufacturer} ${this.model} (${this.registration})`;
});

aircraftSchema.virtual('full_specifications').get(function() {
    return `${this.manufacturer} ${this.model} - ${this.specifications.max_passengers} passengers, ${this.specifications.max_range}nm range`;
});

// Methods
aircraftSchema.methods.updateLocation = function(airportCode, airportName, city, country) {
    this.current_location = {
        airport_code: airportCode,
        airport_name: airportName || '',
        city: city || '',
        country: country || '',
        updated_at: new Date()
    };
    return this.save();
};

aircraftSchema.methods.updateStatus = function(status) {
    this.current_status = status;
    this.updated_at = new Date();
    return this.save();
};

aircraftSchema.methods.addNote = function(note, category = 'general', priority = 'medium', addedBy, isPrivate = false) {
    this.notes.push({
        note,
        category,
        priority,
        added_by: addedBy,
        is_private: isPrivate
    });
    return this.save();
};

aircraftSchema.methods.addBlockedDate = function(startDate, endDate, reason = 'other', notes = '') {
    this.scheduling_info.blocked_dates.push({
        start_date: startDate,
        end_date: endDate,
        reason,
        notes
    });
    return this.save();
};

aircraftSchema.methods.updateFlightStats = function(flightHours, distance, passengers, fuelConsumed) {
    this.flight_statistics.total_flights += 1;
    this.flight_statistics.total_flight_hours += flightHours;
    this.flight_statistics.total_distance += distance;
    this.flight_statistics.total_passengers_carried += passengers;
    this.flight_statistics.fuel_consumed_total += fuelConsumed;
    this.flight_statistics.last_flight_date = new Date();
    
    // Update maintenance info
    this.maintenance_info.total_flight_hours += flightHours;
    this.maintenance_info.hours_since_last_inspection += flightHours;
    this.maintenance_info.total_cycles += 1;
    
    return this.save();
};

export default m.model('aircraft', aircraftSchema);