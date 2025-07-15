
import populate from 'mongoose-autopopulate';
import m from 'mongoose';
const Schema = m.Schema
const sch = new Schema({
    username: String,
    password: String,
    name: String,
    email: { type: String, default: '' },
    level: Number,
    phone: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, autopopulate: { select: 'username name email' }, ref: 'user' },
    createdAt: { type: Date, default: Date.now },
    deleted: { type: Number, default: 0 },
    deletedBy: { type: Schema.Types.ObjectId, autopopulate: { select: 'username name email' }, ref: 'user' },
    deletedAt: { type: Date },
    last_login: { type: Date },
})

sch.index({ username: 1 }, { unique: true })
sch.plugin(populate)

export default m.model('user', sch);