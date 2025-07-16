// import { AppVersion } from '../appVersion';
import crypto from 'crypto';
import m, { Model, ObjectId } from 'mongoose';
import { reqPaging } from './utils';
import moment from 'moment';
import { SignerFunction } from '../library/base_signer';
import { AVIATION_ROLES, PERMISSION_LEVELS, getRoleFromLevel } from '../library/aviation_permissions';
import speakeasy from 'speakeasy';

type tLoginFunc=(username:string, password:string, twoFactorToken?: string)=>Promise<[string, any]>;
type tInsertFunc=(data:any, uid:string)=>Promise<any>;
type tUpdateFunc=(data:any, uid:string)=>Promise<any>;
type tUpdateProfileFunc=(uid:string, data:any)=>Promise<string>;
type tChangePasswFunc=(username:string, current:string, newPassw: string)=>Promise<any>;
type tCreateUserFunc=(data:any, createdBy?:ObjectId)=>Promise<any>;
type tCreateDefaultUser=(password: string)=>Promise<any>;
type tPaging=(page:number, perPage:number, search:string, level:number, qry:any, sort:any)=>Promise<any>;
type tUpdateLastLogin= (idUser: ObjectId) => Promise<void>;
type tSetupTwoFactorFunc=(userId: string)=>Promise<{secret: string, qrCode: string}>;
type tVerifyTwoFactorFunc=(userId: string, token: string)=>Promise<boolean>;
type tDisableTwoFactorFunc=(userId: string, password: string)=>Promise<boolean>;
type tCreateAviationUserFunc=(userData: any, role: string, createdBy?: ObjectId)=>Promise<any>;

export interface tUserIntf {
    Login: tLoginFunc
    insert: tInsertFunc
    update: tUpdateFunc 
    updateProfile: tUpdateProfileFunc
    changePassword: tChangePasswFunc
    createUser: tCreateUserFunc
    createDefaultUser: tCreateDefaultUser
    createAviationUser: tCreateAviationUserFunc
    paging: tPaging
    updateLastLogin: tUpdateLastLogin
    setupTwoFactor: tSetupTwoFactorFunc
    verifyTwoFactor: tVerifyTwoFactorFunc
    disableTwoFactor: tDisableTwoFactorFunc
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
    const Login: tLoginFunc = async (username: string, password: string, twoFactorToken?: string) => {
        const hashed = makeHashPassword(username, password);
        const uData = await USERSCH.findOne({ username, password: hashed });
        
        if (!uData) {
            throw new Error(`User ${username} Not Found or Wrong Password!`);
        }
        
        if (uData.block || !uData.active) {
            throw new Error(`User ${username} Disabled!`);
        }
        
        // Check account lockout
        if (uData.account_locked_until && new Date() < uData.account_locked_until) {
            throw new Error(`Account temporarily locked. Try again later.`);
        }
        
        // Verify 2FA if enabled
        if (uData.two_factor_enabled) {
            if (!twoFactorToken) {
                throw new Error('Two-factor authentication token required');
            }
            
            const isValidToken = speakeasy.totp.verify({
                secret: uData.two_factor_secret,
                encoding: 'base32',
                token: twoFactorToken,
                window: 1
            });
            
            if (!isValidToken) {
                // Increment failed login attempts
                await USERSCH.updateOne(
                    { _id: uData._id },
                    { 
                        $inc: { failed_login_attempts: 1 },
                        $set: { last_failed_login: new Date() }
                    }
                );
                
                // Lock account after 5 failed attempts
                if (uData.failed_login_attempts >= 4) {
                    const lockUntil = new Date();
                    lockUntil.setMinutes(lockUntil.getMinutes() + 30); // Lock for 30 minutes
                    await USERSCH.updateOne(
                        { _id: uData._id },
                        { $set: { account_locked_until: lockUntil } }
                    );
                }
                
                throw new Error('Invalid two-factor authentication token');
            }
        }
        
        // Reset failed login attempts on successful login
        await USERSCH.updateOne(
            { _id: uData._id },
            { 
                $set: { 
                    failed_login_attempts: 0,
                    last_failed_login: null,
                    account_locked_until: null
                }
            }
        );
        
         
        const { password: pwd, createdBy, two_factor_secret, ...less } = JSON.parse(JSON.stringify(uData));
        const level = less.level;
        const role = less.role || getRoleFromLevel(level);
        
        return [signer({ ...less, level, role }), uData];
    }

    const insert: tInsertFunc = async (data: any, uid:string) => {
        const { password: pwd, username, ...less } = data;
        const password = makeHashPassword(username, pwd);
        const createdBy=new m.Types.ObjectId(uid);
        const resp = await USERSCH.create({ ...less, username, password, createdBy });
         
        const { password: pwd2, ...result } = resp;
        return result;
    }

    const update: tUpdateFunc = async (data: any, id: string) => {
        const { password: pwd, username, ...less } = data;
        if (!!pwd && pwd !== '') {
            const password = makeHashPassword(username, pwd);
            const _id= new m.Types.ObjectId(id);
            const resp = await USERSCH.findOneAndUpdate({ _id }, { $set: { ...less, password } });
             
            const { password: pwd2, ...result } = resp._doc;
            return result;
        }
        const _id= new m.Types.ObjectId(id);
        const resp = await USERSCH.findOneAndUpdate({ _id }, { $set: { ...less } });
         
        const { password: pwd2, ...result } = resp._doc;
        return result;
    }

    const updateProfile: tUpdateFunc = async (userId:string, body: any) => {
        const { name, email, phone } = body;
        await USERSCH.updateOne({ _id: new m.Types.ObjectId(userId) }, { $set: { name, email, phone } });
        const usr:any = await USERSCH.findOne({ _id: new m.Types.ObjectId(userId) }, '', { lean: true });
         
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

    const createAviationUser: tCreateAviationUserFunc = async (userData: any, role: string, createdBy?: ObjectId) => {
        const { username, password, ...etc } = userData;
        
        // Validate aviation role
        if (!Object.values(AVIATION_ROLES).includes(role as any)) {
            throw new Error(`Invalid aviation role: ${role}`);
        }
        
        // Get permission level for role
        const level = PERMISSION_LEVELS[role.toUpperCase() as keyof typeof PERMISSION_LEVELS] || PERMISSION_LEVELS.CLIENT;
        
        const hashed = makeHashPassword(username, password);
        const resp = await USERSCH.create({ 
            ...etc, 
            username, 
            password: hashed, 
            role,
            level,
            createdBy,
            updatedAt: new Date()
        });
        
         
        const { password: pswd, two_factor_secret, ...less } = JSON.parse(JSON.stringify(resp));
        return less;
    }

    const setupTwoFactor: tSetupTwoFactorFunc = async (userId: string) => {
        const secret = speakeasy.generateSecret({
            name: 'EdiflySI Private Jet Management',
            length: 32
        });
        
        await USERSCH.updateOne(
            { _id: new m.Types.ObjectId(userId) },
            { $set: { two_factor_secret: secret.base32 } }
        );
        
        return {
            secret: secret.base32,
            qrCode: secret.otpauth_url || ''
        };
    }

    const verifyTwoFactor: tVerifyTwoFactorFunc = async (userId: string, token: string) => {
        const user = await USERSCH.findById(userId);
        if (!user || !user.two_factor_secret) {
            return false;
        }
        
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
        
        if (verified) {
            await USERSCH.updateOne(
                { _id: new m.Types.ObjectId(userId) },
                { $set: { two_factor_enabled: true } }
            );
        }
        
        return verified;
    }

    const disableTwoFactor: tDisableTwoFactorFunc = async (userId: string, password: string) => {
        const user = await USERSCH.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const hashed = makeHashPassword(user.username, password);
        if (user.password !== hashed) {
            throw new Error('Invalid password');
        }
        
        await USERSCH.updateOne(
            { _id: new m.Types.ObjectId(userId) },
            { 
                $set: { 
                    two_factor_enabled: false,
                    two_factor_secret: ''
                }
            }
        );
        
        return true;
    }

    return {
        Login,
        insert,
        update,
        updateProfile,
        changePassword,
        createUser,
        createDefaultUser,
        createAviationUser,
        paging,
        updateLastLogin,
        setupTwoFactor,
        verifyTwoFactor,
        disableTwoFactor
    }
}
