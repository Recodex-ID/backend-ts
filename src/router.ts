import {Router} from 'express';
import moment from 'moment';
import AuthCtrl from './controller/auth';    
const rtr=Router();

rtr.get('/', (req, res)=>{
    res.json({error:0, data:moment().unix()});
})

rtr.use('/auth', AuthCtrl);

export default rtr;