import { Request } from 'express';
import LOGSCH from '../schema/activity_log';
import { ObjectId } from 'mongoose';

export const CreateRandomString=(len:number=8, dict:string ='056789QWERTYUIOPqwertyopasdfghjklzxcvbnmASDFGHJKLZXCVBNM1234')=>{
    // const dict=;
    let result='';
    for (let iii = 0; iii < len; iii++) {
        const charAt=Math.floor(Math.random() * 1000) % dict.length;
        result=dict[charAt]+result;
    }
    return result;
}

const parseIps=(ips:any)=>{
    console.log({ips});
    if(Array.isArray(ips))
    {
       return ips.length>0?ips[ips.length-1]:false;
    } 
    if(!ips)return false;
    if(typeof ips==='string')
    {
        const [ip_address]=ips.split(',');
        return ip_address;
    }
    return ips;
}

export const getIpAddr=(req: Request)=>{
    const {headers, ip, hostname, ips}=req;
    return parseIps(headers['x-forwarded-for']) || parseIps(ips) || ip || hostname;
}

export interface AviationLogOptions {
    action_type?: string;
    resource_type?: string;
    resource_id?: ObjectId;
    details?: {
        before_data?: any;
        after_data?: any;
        metadata?: any;
    };
    severity?: string;
    compliance_relevant?: boolean;
    session_id?: string;
    api_endpoint?: string;
    http_method?: string;
    response_code?: number;
    duration_ms?: number;
}

export const createLog = async(user_id: ObjectId, log: string, req: Request)=>{
    const ip_address=getIpAddr(req);
    return await LOGSCH.create({user_id, ip_address, log});
}

export const createAviationLog = async(
    user_id: ObjectId, 
    log: string, 
    req: Request,
    options: AviationLogOptions = {}
) => {
    const ip_address = getIpAddr(req);
    const user_agent = req.headers['user-agent'];
    const session_id = options.session_id || req.headers['session-id'] || CreateRandomString(16);
    
    const logData = {
        user_id,
        ip_address,
        log,
        action_type: options.action_type || 'view',
        resource_type: options.resource_type || 'system',
        resource_id: options.resource_id,
        details: options.details,
        severity: options.severity || 'low',
        compliance_relevant: options.compliance_relevant || false,
        session_id,
        user_agent,
        api_endpoint: req.originalUrl || req.url,
        http_method: req.method,
        response_code: options.response_code,
        duration_ms: options.duration_ms
    };
    
    return await LOGSCH.create(logData);
}
