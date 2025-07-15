/* eslint-disable @typescript-eslint/no-explicit-any */
// import { AppVersion } from '../appVersion';
import crypto from 'crypto';
import m, { Model, ObjectId } from 'mongoose';
import { reqPaging } from './utils';
import moment from 'moment';
import { SignerFunction } from '../library/base_signer';

type tLoginFunc=(username:string, password:string)=>Promise<[string, any]>;
type tInsertFunc=(data:any, uid:string)=>Promise<any>;
type tUpdateFunc=(data:any, uid:string)=>Promise<any>;
type tUpdateProfileFunc=(uid:string, data:any)=>Promise<string>;
type tChangePasswFunc=(username:string, current:string, newPassw: string)=>Promise<any>;
type tCreateUserFunc=(data:any, createdBy?:ObjectId)=>Promise<any>;
type tCreateDefaultUser=(password: string)=>Promise<any>;
type tPaging=(page:number, perPage:number, search:string, level:number, qry:any, sort:any)=>Promise<any>;
type tUpdateLastLogin= (idUser: ObjectId) => Promise<void>;

export interface tUserIntf {
    Login: tLoginFunc
    insert: tInsertFunc
    update: tUpdateFunc 
    updateProfile: tUpdateProfileFunc
    changePassword: tChangePasswFunc
    createUser: tCreateUserFunc
    createDefaultUser: tCreateDefaultUser
    paging: tPaging
    updateLastLogin: tUpdateLastLogin
} 


export default (USERSCH:Model<any>, saltName: string, signer: SignerFunction): tUserIntf => {
    const defaultUsername = 'admin';
    const defaultLevel = 0x1fff0;
    // console.log({USERSCH, SALT, signer, env:process.env})
    const makeHashPassword = (username:string, password:string) => {
        // const SALT=process.env[saltName];
        const salt = process.env[saltName] || 'SADHUWHENDMSABVHSACJASLWQPR';
        const hash = crypto.createHmac('sha256', salt);
        hash.update(username);
        hash.update(password);
        return hash.digest('hex');
    }
    const Login: tLoginFunc = async (username: string, password: string) => {
        const hashed = makeHashPassword(username, password);
        // console.log(username, password, {SALT});
        const uData = await USERSCH.findOne({ username, password: hashed });
        if (!uData) {
            throw new Error(`User ${username} Not Found or Wrong Password!`);
        }
        if (uData.block) {
            throw new Error(`User ${username} Disabled!`)
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: pwd, createdBy, ...less } = JSON.parse(JSON.stringify(uData));
        const level = less.level;
        // const ver = AppVersion;
        // const tpis = await getTPIS({ ...less, tpi_id });
        return [signer({ ...less, level, }), uData];
    }

    const insert: tInsertFunc = async (data: any, uid:string) => {
        const { password: pwd, username, ...less } = data;
        const password = makeHashPassword(username, pwd);
        const createdBy=new m.Types.ObjectId(uid);
        const resp = await USERSCH.create({ ...less, username, password, createdBy });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: pwd2, ...result } = resp;
        return result;
    }

    const update: tUpdateFunc = async (data: any, id: string) => {
        const { password: pwd, username, ...less } = data;
        if (!!pwd && pwd !== '') {
            const password = makeHashPassword(username, pwd);
            const _id= new m.Types.ObjectId(id);
            const resp = await USERSCH.findOneAndUpdate({ _id }, { $set: { ...less, password } });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password: pwd2, ...result } = resp._doc;
            return result;
        }
        const _id= new m.Types.ObjectId(id);
        const resp = await USERSCH.findOneAndUpdate({ _id }, { $set: { ...less } });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: pwd2, ...result } = resp._doc;
        return result;
    }

    const updateProfile: tUpdateFunc = async (userId:string, body: any) => {
        const { name, email, phone } = body;
        await USERSCH.updateOne({ _id: new m.Types.ObjectId(userId) }, { $set: { name, email, phone } });
        const usr:any = await USERSCH.findOne({ _id: new m.Types.ObjectId(userId) }, '', { lean: true });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...less } = usr;
        return signer(less);
    }

    const changePassword: tChangePasswFunc = async (username:string, current:string, password:string) => {
        const hashed = makeHashPassword(username, password);
        const currPass = makeHashPassword(username, current);

        const correct = await USERSCH.findOne({ username, password: currPass });
        if (!correct) throw new Error('Wrong Current Password!');
        // console.log({hashed});
        return await USERSCH.updateOne({ username }, { $set: { password: hashed } });
    }

    const createUser: tCreateUserFunc = async (userData:any, createdBy?: ObjectId) => {
        const { username, password, ...etc } = userData;
        const hashed = makeHashPassword(username, password);
        const resp = await USERSCH.create({ ...etc, username, password: hashed, createdBy });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: pswd, ...less } = resp._id;
        return less;
    }

    const createDefaultUser: tCreateDefaultUser = async (password: string) => {
        const exists = await USERSCH.findOne({ username: defaultUsername });
        if (exists) throw new Error('User Default Exists!');
        return await createUser({ username: defaultUsername, password, name: 'Super User', level: defaultLevel });
    }

    const paging: tPaging = async (page:number, perPage:number, search:string, level:number, qry:any, sort:any) => {
        const filter = {
            level: { $lte: level },
            $or: [
                { username: new RegExp(search, 'i') },
                { name: new RegExp(search, 'i') },
            ],
            ...qry
        };
        const currSort = Object.keys(sort).length > 0 ? sort : { _id: -1, }
        return await reqPaging(USERSCH, page, perPage, filter, { ...currSort }, '-password');
    }

    const updateLastLogin: tUpdateLastLogin = async (idUser: ObjectId) => {
        if (!idUser) throw Error("Not Found User Id!")
        await USERSCH.findByIdAndUpdate(idUser, { last_login: moment().toDate() });
    }

    return {
        Login,
        insert,
        update,
        updateProfile,
        changePassword,
        createUser,
        createDefaultUser,
        paging,
        updateLastLogin
    }
}
