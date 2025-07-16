import populate from 'mongoose-autopopulate';
import m from 'mongoose';
const Schema = m.Schema;

const clientSchema = new Schema({
    // Basic Information
    client_id: { type: String, required: true },
    company_name: { type: String, default: '' },
    contact_person: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    
    // Personal Information
    title: { type: String, enum: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', ''], default: '' },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    date_of_birth: { type: Date },
    nationality: { type: String, default: '' },
    passport_number: { type: String, default: '' },
    passport_expiry: { type: Date },
    
    // Address Information
    billing_address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        postal_code: { type: String, default: '' },
        country: { type: String, default: '' }
    },
    shipping_address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        postal_code: { type: String, default: '' },
        country: { type: String, default: '' },
        same_as_billing: { type: Boolean, default: true }
    },
    
    // Emergency Contacts
    emergency_contacts: [{
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, default: '' },
        is_primary: { type: Boolean, default: false }
    }],
    
    // Travel Preferences
    travel_preferences: {
        preferred_departure_time: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', 'flexible'], default: 'flexible' },
        preferred_aircraft_type: { type: String, default: '' },
        seating_preference: { type: String, enum: ['forward', 'middle', 'rear', 'window', 'aisle', 'no_preference'], default: 'no_preference' },
        meal_preference: { type: String, enum: ['regular', 'vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'dairy_free', 'no_meal'], default: 'regular' },
        special_requests: { type: String, default: '' },
        mobility_assistance: { type: Boolean, default: false },
        pet_travel: { type: Boolean, default: false },
        frequent_destinations: [{ type: String }],
        blacklisted_destinations: [{ type: String }]
    },
    
    // VIP Services & Preferences
    vip_services: {
        is_vip: { type: Boolean, default: false },
        vip_level: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'], default: 'bronze' },
        concierge_services: { type: Boolean, default: false },
        ground_transportation: { type: Boolean, default: false },
        catering_preferences: { type: String, default: '' },
        beverage_preferences: { type: String, default: '' },
        amenities_requests: [{ type: String }],
        special_occasions: [{
            date: Date,
            type: { type: String, enum: ['birthday', 'anniversary', 'business_meeting', 'celebration', 'other'] },
            notes: String
        }]
    },
    
    // Communication Preferences
    communication_preferences: {
        preferred_method: { type: String, enum: ['email', 'sms', 'phone', 'whatsapp', 'app_notification'], default: 'email' },
        language: { type: String, default: 'en' },
        timezone: { type: String, default: 'UTC' },
        marketing_opt_in: { type: Boolean, default: false },
        notifications: {
            booking_confirmations: { type: Boolean, default: true },
            flight_updates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false },
            surveys: { type: Boolean, default: false }
        },
        communication_history: [{
            date: { type: Date, default: Date.now },
            method: { type: String, enum: ['email', 'sms', 'phone', 'whatsapp', 'in_person'] },
            subject: String,
            content: String,
            sent_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name' } },
            response_required: { type: Boolean, default: false },
            response_received: { type: Boolean, default: false }
        }]
    },
    
    // Billing Information
    billing_info: {
        payment_methods: [{
            type: { type: String, enum: ['credit_card', 'debit_card', 'bank_transfer', 'wire_transfer', 'check', 'cash'], required: true },
            card_type: { type: String, enum: ['visa', 'mastercard', 'amex', 'discover', ''], default: '' },
            card_number_last_four: { type: String, default: '' },
            expiry_month: { type: Number, min: 1, max: 12 },
            expiry_year: { type: Number },
            cardholder_name: { type: String, default: '' },
            billing_address_same: { type: Boolean, default: true },
            is_default: { type: Boolean, default: false }
        }],
        billing_cycle: { type: String, enum: ['immediate', 'monthly', 'quarterly', 'annually'], default: 'immediate' },
        credit_limit: { type: Number, default: 0 },
        current_balance: { type: Number, default: 0 },
        payment_terms: { type: String, enum: ['net_15', 'net_30', 'net_45', 'net_60', 'immediate'], default: 'net_30' },
        tax_id: { type: String, default: '' },
        tax_exempt: { type: Boolean, default: false }
    },
    
    // Client Status & Classification
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'blacklisted'], default: 'active' },
    client_type: { type: String, enum: ['individual', 'corporate', 'charter', 'government'], default: 'individual' },
    client_source: { type: String, enum: ['referral', 'marketing', 'website', 'social_media', 'partner', 'other'], default: 'website' },
    assigned_account_manager: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name email phone' } },
    
    // Flight History Summary (detailed history in separate collection)
    flight_statistics: {
        total_flights: { type: Number, default: 0 },
        total_flight_hours: { type: Number, default: 0 },
        total_distance: { type: Number, default: 0 },
        total_spent: { type: Number, default: 0 },
        last_flight_date: { type: Date },
        favorite_route: { type: String, default: '' },
        most_used_aircraft: { type: String, default: '' }
    },
    
    // Privacy & Compliance
    privacy_settings: {
        data_processing_consent: { type: Boolean, default: false },
        marketing_consent: { type: Boolean, default: false },
        data_retention_period: { type: Number, default: 2555 }, // days (7 years default)
        gdpr_compliant: { type: Boolean, default: true },
        data_export_requests: [{
            requested_date: { type: Date, default: Date.now },
            processed_date: { type: Date },
            status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' }
        }],
        data_deletion_requests: [{
            requested_date: { type: Date, default: Date.now },
            scheduled_date: { type: Date },
            status: { type: String, enum: ['pending', 'scheduled', 'completed', 'failed'], default: 'pending' }
        }]
    },
    
    // Notes & Comments
    notes: [{
        date: { type: Date, default: Date.now },
        note: { type: String, required: true },
        category: { type: String, enum: ['general', 'preference', 'complaint', 'compliment', 'billing', 'safety', 'other'], default: 'general' },
        priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        added_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name' } },
        is_private: { type: Boolean, default: false }
    }],
    
    // System Fields
    created_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name email' } },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    last_contact_date: { type: Date },
    next_follow_up: { type: Date },
    
    // Soft Delete
    deleted: { type: Number, default: 0 },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'user', autopopulate: { select: 'username name email' } },
    deleted_at: { type: Date }
});

// Indexes for performance
clientSchema.index({ client_id: 1 }, { unique: true });
clientSchema.index({ email: 1 }, { unique: true });
clientSchema.index({ first_name: 1, last_name: 1 });
clientSchema.index({ company_name: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ client_type: 1 });
clientSchema.index({ 'vip_services.is_vip': 1 });
clientSchema.index({ assigned_account_manager: 1 });
clientSchema.index({ created_at: -1 });
clientSchema.index({ last_contact_date: -1 });

// Text search index
clientSchema.index({
    first_name: 'text',
    last_name: 'text',
    company_name: 'text',
    email: 'text',
    phone: 'text',
    client_id: 'text'
});

// Plugins
clientSchema.plugin(populate);

// Pre-save middleware
clientSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Virtual fields
clientSchema.virtual('full_name').get(function() {
    return `${this.first_name} ${this.last_name}`;
});

clientSchema.virtual('display_name').get(function() {
    return this.company_name || `${this.first_name} ${this.last_name}`;
});

// Methods
clientSchema.methods.updateContactDate = function() {
    this.last_contact_date = new Date();
    return this.save();
};

clientSchema.methods.addNote = function(note, category = 'general', priority = 'medium', addedBy, isPrivate = false) {
    this.notes.push({
        note,
        category,
        priority,
        added_by: addedBy,
        is_private: isPrivate
    });
    return this.save();
};

export default m.model('client', clientSchema);