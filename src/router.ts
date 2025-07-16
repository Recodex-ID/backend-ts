import {Router} from 'express';
import moment from 'moment';
import AuthCtrl from './controller/auth';
import ClientCtrl from './controller/client';
const rtr=Router();

rtr.get('/', (req, res)=>{
    res.json({error:0, data:moment().unix()});
})

rtr.use('/auth', AuthCtrl);
rtr.use('/clients', ClientCtrl);

export default rtr;