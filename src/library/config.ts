import os from 'os';    
import fs from 'fs';
import {cpu} from 'systeminformation';
import serNumb from 'serial-number';
import { CreateRandomString } from './utils';

export interface tdatabase {
    connection:string
}

interface tserver {
    port: number
    bind: string
}

interface tconfig {
    database: tdatabase
    server: tserver
    image_path: string
    salt: string
    isStaging: boolean
}

const getHomeDir=():string=>os.homedir();

export const getOsPlatform=():string=>os.platform()
export const getCPU=async()=>{
    return (await cpu());
}
export const getSerNum = ():Promise<string>=>{
    return new Promise((res, rej)=>{
        serNumb((e, v)=>{
            if(!e){
                res(v)
            }
            else{
                rej(e)
            }
        })

    })
}

const getDefaultConfig=():tconfig => {
    return {
        database:{
            connection:''
        },
        server:{
            bind:'127.0.0.1',
            port:11611
        },
        image_path:__dirname+'/images/',
        salt:CreateRandomString(24),
        isStaging:false
    }
}

export const getConfigFile=():tconfig => {
    const home = getHomeDir();
    const appName=process.env.NAME || '.edifly-si';
    const configDir=`${home}/.${appName}`;
    if(!fs.existsSync(configDir)){
        fs.mkdirSync(configDir);
    }
    const configFile=`${configDir}/config.json`;
    if(!fs.existsSync(configFile)){
        fs.writeFileSync(configFile, '{}');
    }
    const defCfg = getDefaultConfig();
    const json = fs.readFileSync(configFile);
    const config = JSON.parse(json.toString());
    return {...defCfg, ...config};
}