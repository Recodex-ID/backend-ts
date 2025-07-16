import { NextFunction, Request, Response, Router} from 'express';
import m, { Model } from 'mongoose';
import { createModel } from '../model/utils';
// import { getEnv } from '../library/apps';
import {getConfigFile} from '../library/config';
import moment from 'moment';
import { DecodeFunction } from '../library/base_signer';
import { CreateRandomString, createLog } from '../library/utils';
import { tUserIntf } from '../model/base_users';
import captcha from '@bestdon/nodejs-captcha';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

export const AuthMiddleware = (decode: DecodeFunction) => (req: Request, res: Response, next: NextFunction) => {

    const authHeader:string = process.env.AUTHHEADER || 'srawung-token';
    const aToken = req.headers[authHeader] || req.query?.token || '';
    
    if (!aToken) {
        res.status(403).json({ error: 403, message: "Forbidden! Authentication token required." });
        return;
    }
    
    const start = new Date().getTime();
    res.set("before-token-timestamps", `${start}`);
    
    try {
        const uData = decode(`${aToken}`);
        if (!uData) {
            res.status(401).json({ error: 401, message: 'Auth Token Invalid or Expired!' });
            return;
        }
        
        res.locals.udata = { ...uData };
        res.locals.token = aToken;
        const end = new Date().getTime();
        res.set("after-token-timestamps", `${end}`);
        res.set('token-time-ms', `${end - start}`);
        next();
    } catch (error) {
        res.status(401).json({ error: 401, message: 'Auth Token Invalid or Expired!' });
        return;
    }
}

export const RestApiMiddleware = (_req: Request, _res: Response, next:NextFunction) => {
    next();
}

// Rate limiting for authentication endpoints
export const createAuthRateLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 429,
        message: 'Too many authentication attempts from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiting for password-related endpoints
export const createPasswordRateLimiter = () => rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password change attempts per hour
    message: {
        error: 429,
        message: 'Too many password change attempts from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware for login
export const validateLogin = [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage('Username can only contain letters, numbers, dots, underscores, and hyphens'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
    body('captcha')
        .isLength({ min: 6, max: 6 })
        .withMessage('Captcha must be exactly 6 characters')
        .matches(/^[0-9]+$/)
        .withMessage('Captcha must contain only numbers'),
    body('token')
        .isLength({ min: 1 })
        .withMessage('Captcha token is required'),
    body('twoFactorToken')
        .optional()
        .isLength({ min: 6, max: 6 })
        .withMessage('Two-factor token must be exactly 6 characters')
        .matches(/^[0-9]+$/)
        .withMessage('Two-factor token must contain only numbers'),
];

// Validation middleware for password change
export const validatePasswordChange = [
    body('current')
        .isLength({ min: 8 })
        .withMessage('Current password must be at least 8 characters long'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

// Validation middleware for profile update
export const validateProfileUpdate = [
    body('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('phone')
        .optional()
        .matches(/^[+]?[0-9\s\-()]+$/)
        .withMessage('Please provide a valid phone number'),
];

// Validation result checker
export const checkValidationResult = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 400,
            message: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

type tCallbackHandler=(body:any)=>any;

export const CtrlHandler = async (req: Request, res: Response, callback: tCallbackHandler, httpErrorCode: boolean = false) => {
    const jres = {
        error: 0,
        data: [],
        message: '',
        stack: {},
        errorName: ''
    }
    const start = new Date().getTime();
    res.set("before-exec-timestamps", `${start}`);
    
    try {
        jres.data = await callback(req.body)
    } catch (error) {
        // Log the full error for debugging purposes
        console.error('Controller Error:', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString()
        });

        if (!httpErrorCode) {
            jres.error = 500;
            
            // Don't expose sensitive error details in production
            if (process.env.NODE_ENV === 'production') {
                // Only expose safe error messages
                const safeMessages = [
                    'User',
                    'Not Found',
                    'Wrong Password',
                    'Disabled',
                    'Invalid',
                    'Expired',
                    'Token',
                    'Two-factor',
                    'required',
                    'Validation',
                    'failed',
                    'locked',
                    'Captcha',
                    'Privileges',
                    'permission'
                ];
                
                const isSafeMessage = safeMessages.some(safe => error.message.includes(safe));
                jres.message = isSafeMessage ? error.message : 'An error occurred processing your request';
            } else {
                jres.message = error.message;
                jres.errorName = error.name;
            }
        } else {
            const statusCode = error.statusCode || 500;
            const message = process.env.NODE_ENV === 'production' 
                ? 'An error occurred processing your request' 
                : error.message;
            res.status(statusCode).json({ error: statusCode, message });
            return;
        }
    }
    
    if (jres.data !== undefined) {
        const end = new Date().getTime();
        res.set("after-exec-timestamps", `${end}`);
        res.set('execution-time-ms', `${end - start}`);
        res.json(jres);
    }
}
type tBeforeSaveData=(_data:object, _level:number, _uid:string, _req:Request) => Promise<object>;
type tBeforeRead=(_search:string, _search2:string, _filter:object)=>Promise<object>;
type tAfterSave=(_data:object)=>Promise<object>;
type tBeforeInq=(_data:object, _userData?:object)=>Promise<object>;
type tBeforeDetailResp=(_data:object, _isMultiple:boolean, _uid:string)=>Promise<object>;
type tAddAuthQry=(_udata:object)=>Promise<object>;
type tAfterInq=(_inqData:object)=>Promise<object>;

export interface tCrudFunctionCallback{
    beforeSaveData?:tBeforeSaveData
    beforeRead?:tBeforeRead
    afterSave?:tAfterSave
    beforeInq?: tBeforeInq
    beforeDetailResponse?:tBeforeDetailResp
    addAuthQry?:tAddAuthQry
    afterInq?:tAfterInq
}

export const createCrudController = (schema:Model<any>, level: number = 0, defSearch: Array<string> = [],  
    sort: object = { _id: -1 }, projector: string = '', initialFilter: object = {}, crudCallback?:tCrudFunctionCallback): Router => {
    const rtr = Router();
    const {addAuthQry, afterInq, afterSave, beforeDetailResponse, beforeInq, beforeRead, beforeSaveData} = crudCallback;
    const { insert, reqPaging, update } = createModel(schema);
    rtr.get('/', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            // const {  search2, page, perPage } = req.query;
            const search = req.query.search as string;
            const search2 = req.query.search2 as string;
            const page = req.query.page as string;
            const perPage = req.query.perPage as string;
            let filter = { ...initialFilter };
            // console.log({filter});
            if (!!beforeRead && typeof beforeRead === 'function') {
                filter = await beforeRead(search, search2, filter)
            } else {
                if (search) {
                    const o = [];
                    const r = new RegExp(search, 'i');
                    for (let iii = 0; iii < defSearch.length; iii++) {
                        const f = defSearch[iii];
                        o.push({ [f]: r });
                    }
                    filter = { ...filter, $or: o };
                } else if (search2) {
                    const f = JSON.parse(search2);
                    filter = { ...filter, ...f };
                }
            }
            // console.log({filter});
            return await reqPaging(schema, parseInt(page), parseInt(perPage), filter, sort, projector)
        })
    })

    rtr.post('/', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { level: lvl, _id: uid } = res.locals.udata;
            let data = body;
            if (!!beforeSaveData && typeof beforeSaveData === 'function') {
                data = await beforeSaveData(data, level, uid, req);
            }
            if (level === 0 || ((level & lvl) > 0)) {
                // console.log({data});
                const { _id } = data;
                if (_id) {
                    let saved = await update({ ...data, updatedAt: new Date() }, _id);
                    if (!!afterSave && typeof afterSave === 'function') {
                        saved = await afterSave(saved)
                    }
                    return saved;
                }
                let saved = await insert(data, uid);
                if (!!afterSave && typeof afterSave === 'function') {
                    saved  = await afterSave(saved)
                }
                return saved;
            }
            throw new Error('Error Privileges!');
        })
    })

    const cleanQry = (qry: Array<string>) => {
        const result = {};
        for (const key in qry) {
            if (Object.hasOwnProperty.call(qry, key)) {
                const v = qry[key];
                if (key.indexOf('$') >= 0) continue;
                if(key==='timestamp')continue;
                result[key] = v;
            }
        }
        return result;
    }

    rtr.get('/pagination', (req, res) => {
        CtrlHandler(req, res, async () => {
            // const { search, page, perPage } = req.query;
            const search = req.query.search as string;
            // const search2 = req.query.search2 as string;
            const page = req.query.page as string;
            const perPage = req.query.perPage as string;

            const offset = (parseInt(page) - 1) * parseInt(perPage);
            const authQry = addAuthQry ? await addAuthQry(res.locals.udata) : {};
            let filter = { ...initialFilter, ...authQry };
            const jsSearch = JSON.parse(search);
            const f = cleanQry(jsSearch);
            const query = f;
            const qry = {};
            for (const key in query) {
                if (Object.hasOwnProperty.call(query, key)) {
                    const v = query[key];
                    if (v) qry[key] = v;
                }
            }
            const inq = (beforeInq && (await beforeInq(qry))) || qry;
            filter = { ...filter, ...inq };
            if (filter['$text']) {
                // console.log({filter});
                const iData = await schema.find(filter, { score: { $meta: "textScore" } }, { limit: parseInt(perPage)||10, skip: offset, sort: { score: { $meta: "textScore" } } });
                const data = (!!afterInq && typeof afterInq === 'function' && await afterInq(iData)) || iData;
                const total = await schema.estimatedDocumentCount();
                const subTotal = await schema.countDocuments(filter);
                return { data, subTotal, total };
            }
            const iData = await schema.find(filter, '', { limit: parseInt(perPage)||10, skip: offset, sort });
            const data = (!!afterInq && typeof afterInq === 'function' && await afterInq(iData)) || iData;
            const total = await schema.estimatedDocumentCount();
            if (JSON.stringify(filter) !== '{}') {
                const subTotal = await schema.countDocuments(filter);
                return { data, subTotal, total };
            }
            return { data, subTotal: total, total };
        })
    })

    rtr.get('/inquiry', (req, res) => {
        CtrlHandler(req, res, async () => {
            const search = req.query.search as string;
            let filter = { ...initialFilter };
            const f = JSON.parse(search);
            const qry = f;
            const inq = !!beforeInq && typeof beforeInq === 'function' && (await beforeInq(qry, res.locals.udata)) || qry;
            filter={...filter, ...inq};
            const data = await schema.find(filter, '', {sort});            
            return (!!afterInq && typeof afterInq === 'function' && await afterInq(data)) || data;
        })
    })

    rtr.get('/detail/:id', (req, res) => {
        CtrlHandler(req, res, async () => {
            const { id } = req.params;
            const { _id: uid } = res.locals.udata;
            const data = await schema.findOne({ _id: id });
            const resp = (!!beforeDetailResponse && typeof beforeDetailResponse === 'function' && await beforeDetailResponse(data, false, uid)) || data;
            return resp;
        })
    })

    rtr.get('/detail/:field/:id', (req, res) => {
        CtrlHandler(req, res, async () => {
            const { id, field } = req.params;
            const { _id: uid } = res.locals.udata;
            const value=new m.Types.ObjectId(id);
            const data = await schema.find({ [field]: value }, '', { sort: { _id: -1 } });
            const resp = (!!beforeDetailResponse && typeof beforeDetailResponse === 'function' && await beforeDetailResponse(data, true, uid)) || data;
            return resp;
        })
    })

    return rtr;
}

export const generateUniqueName = () => {
    return `${moment().unix()}_${CreateRandomString(10)}`;
}

export const createFile = (file) => {
    const { name } = file;
    // file.
    const frag = name.split('.');
    const ext = frag.pop();
    const nm = frag.join('.')
    const imagePath = getConfigFile().image_path;
    const dir = imagePath; //getEnv("imagesPath", __dirname + "/../../static/images");
    const filename = generateUniqueName() + '_' + nm + '.' + ext;
    file.mv(dir + '/' + filename);
    return filename;
}

export interface tColumn {
    title: string
    name: string
    field: string
    type: string
    align?: string
    format?:string
}
type tGetReportFunc=(schema: Model<any>, req: Request, res: Response, first_date: string, last_date?: string)=>Promise<object>;

export const createReportCtrl = (schema: Model<any>, type:string = 'daily', columns:Array<tColumn> = [], getReport: tGetReportFunc) => {
    const rtr = Router();
    const header = columns.map(({ title }) => title);
    const fields = columns.map(({ title, ...rest }) => ({ ...rest }));
    if (type === 'daily') {
        rtr.get('/:first_date/:last_date', (req, res) => {
            CtrlHandler(req, res, async (body) => {
                const { first_date, last_date } = req.params;
                const data = await getReport(schema, req, res, first_date, last_date);
                return { data, header, fields };
            })
        })
    }
    else {
        rtr.get('/:month', (req, res) => {
            CtrlHandler(req, res, async (body) => {
                const { month } = req.params;
                if (typeof getReport === 'function') {
                    const data = await getReport(schema, req, res, month);
                    return { data, header, fields };
                }
                throw new Error("Report callback function not found!");
            });
        })
    }

    return rtr;
}

type refreshTokenFunc=(aToken: string)=>string;

export const createAuthController = (model: tUserIntf, decoder: DecodeFunction, refreshToken: refreshTokenFunc, CaptchaCache: any) => {
    const { changePassword, createDefaultUser, Login, updateProfile, updateLastLogin, setupTwoFactor, verifyTwoFactor, disableTwoFactor, createAviationUser } = model;
    // const CaptchaCache = {};
    const rtr = Router();

    // Rate limiters
    const authLimiter = createAuthRateLimiter();
    const passwordLimiter = createPasswordRateLimiter();

    rtr.post('/login', authLimiter, validateLogin, checkValidationResult, (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { username, password, token, captcha, twoFactorToken } = body;
            if (!CaptchaCache[`${token}`]) throw new Error("Captcha expired!");
            const { timer, value } = CaptchaCache[`${token}`];
            if (value !== captcha) throw new Error('Captcha Invalid');
            clearTimeout(timer);
            delete CaptchaCache[`${token}`];
            try {
                const [authToken, udata] = await Login(username, password, twoFactorToken);

                await updateLastLogin(udata)
                createLog(udata._id, `Login Success For User ${username}`, req);
                return authToken;
            } catch (error) {
                createLog(undefined, `Login Failed For User ${username}`, req);
                throw error;
            }
        });
    });

    rtr.use('/logout', AuthMiddleware(decoder));
    rtr.use('/refreshToken', AuthMiddleware(decoder));
    rtr.use('/profile', AuthMiddleware(decoder));
    rtr.use('/changePassword', AuthMiddleware(decoder));
    rtr.use('/me', AuthMiddleware(decoder));
    rtr.use('/setup-2fa', AuthMiddleware(decoder));
    rtr.use('/verify-2fa', AuthMiddleware(decoder));
    rtr.use('/disable-2fa', AuthMiddleware(decoder));
    rtr.use('/create-aviation-user', AuthMiddleware(decoder));

    rtr.get('/captcha/:uid', (req, res) => {
        CtrlHandler(req, res, async () => {
            const c = captcha({
                charset: '1234567890',
                length: 6,
            });
            const { uid } = req.params;
            const value = c.value;
            if (CaptchaCache[`${uid}`]) {
                const { timer, value } = CaptchaCache[`${uid}`];
                if (timer) clearTimeout(timer);
                delete CaptchaCache[`${uid}`];
            }
            const t = setTimeout(() => {
                delete CaptchaCache[`${uid}`];
            }, 3 * 60 * 1000);

            CaptchaCache[`${uid}`] = { timer: t, value };
            return c.image;
        })
    })

    rtr.get('/logout', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { _id: user_id, username } = res.locals.udata;
            createLog(user_id, `${username} Logout`, req);
            return true;
        });
    });

    rtr.get('/refreshToken', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            return refreshToken(res.locals.token);
        });
    });

    rtr.get('/me', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            return res.locals.udata;
        });
    });


    rtr.post('/profile', validateProfileUpdate, checkValidationResult, (req, res) => {
        CtrlHandler(req, res, async (body) => {
            // console.log(body);
            const { _id, username } = res.locals.udata;
            createLog(_id, `Update Profile for ${username}`, req);
            return await updateProfile(_id, body);
        });
    });

    rtr.post('/changePassword', passwordLimiter, validatePasswordChange, checkValidationResult, (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { username, _id } = res.locals.udata;
            const { password, current } = body;
            await changePassword(username, current, password);
            createLog(_id, `Change password for ${username}`, req);
            return { message: 'Password changed successfully' };
        });
    });

    rtr.post('/setup-2fa', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { _id: userId, username } = res.locals.udata;
            const result = await setupTwoFactor(userId);
            createLog(userId, `Setup 2FA for ${username}`, req);
            return result;
        });
    });

    rtr.post('/verify-2fa', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { _id: userId, username } = res.locals.udata;
            const { token } = body;
            const verified = await verifyTwoFactor(userId, token);
            if (verified) {
                createLog(userId, `2FA enabled for ${username}`, req);
            } else {
                createLog(userId, `Failed 2FA verification for ${username}`, req);
            }
            return { verified };
        });
    });

    rtr.post('/disable-2fa', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { _id: userId, username } = res.locals.udata;
            const { password } = body;
            const disabled = await disableTwoFactor(userId, password);
            createLog(userId, `2FA disabled for ${username}`, req);
            return { disabled };
        });
    });

    rtr.post('/create-aviation-user', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { _id: createdBy, username: creatorUsername, level } = res.locals.udata;
            const { role, ...userData } = body;
            
            // Check if user has permission to create users (super admin or operations manager)
            if (!(level & 0x4000)) {
                throw new Error('Insufficient permissions to create users');
            }
            
            const newUser = await createAviationUser(userData, role, createdBy);
            createLog(createdBy, `Created aviation user ${userData.username} with role ${role} by ${creatorUsername}`, req);
            return newUser;
        });
    });

    return rtr;
}
