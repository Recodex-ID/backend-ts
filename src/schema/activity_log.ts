import m from 'mongoose';
import populate from 'mongoose-autopopulate';

const Schema = m.Schema
const sch = new Schema({
    user_id:{type: Schema.Types.ObjectId, autopopulate:{ select: 'username name email role' }, ref:'user'},
    ip_address:String,    
    log:String,
    action_type: {
        type: String,
        enum: ['login', 'logout', 'create', 'update', 'delete', 'view', 'approve', 'reject', 'schedule', 'cancel', 'maintenance', 'flight_ops', 'financial', 'security'],
        default: 'view'
    },
    resource_type: {
        type: String,
        enum: ['user', 'client', 'aircraft', 'flight', 'crew', 'maintenance', 'billing', 'system'],
        default: 'system'
    },
    resource_id: Schema.Types.ObjectId,
    details: {
        before_data: Schema.Types.Mixed,
        after_data: Schema.Types.Mixed,
        metadata: Schema.Types.Mixed
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    compliance_relevant: { type: Boolean, default: false },
    session_id: String,
    user_agent: String,
    api_endpoint: String,
    http_method: String,
    response_code: Number,
    duration_ms: Number,
    createdAt:{type:Date, default:Date.now},
})

sch.index({user_id:1});
sch.index({ip_address:1});
sch.index({action_type:1});
sch.index({resource_type:1});
sch.index({severity:1});
sch.index({compliance_relevant:1});
sch.index({createdAt:-1});
sch.plugin(populate);

export default m.model('activity_log', sch);