import {Router} from 'express';
import moment from 'moment';
import AuthCtrl from './controller/auth';
import ClientCtrl from './controller/client';
import AircraftCtrl from './controller/aircraft';
const rtr=Router();

rtr.get('/', (req, res)=>{
    res.json({error:0, data:moment().unix()});
})

rtr.use('/auth', AuthCtrl);
rtr.use('/clients', ClientCtrl);
rtr.use('/aircraft', AircraftCtrl);

export default rtr;