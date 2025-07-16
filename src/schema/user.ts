import populate from 'mongoose-autopopulate';
import m from 'mongoose';
const Schema = m.Schema
const sch = new Schema({
    username: String,
    password: String,
    name: String,
    email: { type: String, default: '' },
    level: Number,
    role: { 
        type: String, 
        enum: ['super_admin', 'operations_manager', 'finance_manager', 'maintenance_manager', 
               'client_services', 'crew_member', 'client'], 
        default: 'client' 
    },
    phone: { type: String, default: '' },
    employee_id: { type: String, default: '' },
    department: { type: String, default: '' },
    position: { type: String, default: '' },
    hire_date: { type: Date },
    emergency_contact: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        relationship: { type: String, default: '' }
    },
    certifications: [{
        name: String,
        number: String,
        issued_date: Date,
        expiry_date: Date,
        issuing_authority: String
    }],
    active: { type: Boolean, default: true },
    block: { type: Boolean, default: false },
    two_factor_enabled: { type: Boolean, default: false },
    two_factor_secret: { type: String, default: '' },
    last_password_change: { type: Date, default: Date.now },
    failed_login_attempts: { type: Number, default: 0 },
    last_failed_login: { type: Date },
    account_locked_until: { type: Date },
    preferences: {
        timezone: { type: String, default: 'UTC' },
        language: { type: String, default: 'en' },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true }
        }
    },
    createdBy: { type: Schema.Types.ObjectId, autopopulate: { select: 'username name email' }, ref: 'user' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deleted: { type: Number, default: 0 },
    deletedBy: { type: Schema.Types.ObjectId, autopopulate: { select: 'username name email' }, ref: 'user' },
    deletedAt: { type: Date },
    last_login: { type: Date },
})

sch.index({ username: 1 }, { unique: true })
sch.plugin(populate)

export default m.model('user', sch);