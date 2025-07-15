/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

export const AuthMiddleware = (decode: DecodeFunction) => (req: Request, res: Response, next: NextFunction) => {

    const authHeader:string = process.env.AUTHHEADER || 'srawung-token';
    const aToken = req.headers[authHeader] || req.query?.token || '';
    // console.log(authHeader, aToken, req.headers);
    if (!aToken) {
        res.json({ error: 403, message: "Forbidden!" });
    }
    else {
        const start = new Date().getTime();
        res.set("before-token-timestamps", `${start}`);
        const uData = decode(`${aToken}`);
        if (!uData) {
            res.json({ error: 401, message: 'Auth Token Invalid or Expired!' });
        }
        else {
            res.locals.udata = { ...uData };
            res.locals.token = aToken;
            const end = new Date().getTime();
            res.set("after-token-timestamps", `${end}`);
            res.set('token-time-ms', `${end - start}`);
            next();
        }
    }
}

export const RestApiMiddleware = (req: Request, res: Response, next:NextFunction) => {
    next();
}

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
        if (!httpErrorCode) {
            jres.error = 500;
            jres.message = error.message;
            // jres.stack = error.stack;
            jres.errorName = error.name;
            // console.error(error);
        }
        else {
            res.status(500).send(error.message);
        }
    }
    if (jres.data !== undefined) {
        const end = new Date().getTime();
        res.set("after-exec-timestamps", `${end}`);
        res.set('execution-time-ms', `${end - start}`);
        res.json(jres);
    }
}
type tBeforeSaveData=(data:object, level:number, uid:string, req:Request) => Promise<object>;
type tBeforeRead=(search:string, search2:string, filter:object)=>Promise<object>;
type tAfterSave=(data:object)=>Promise<object>;
type tBeforeInq=(data:object, userData?:object)=>Promise<object>;
type tBeforeDetailResp=(data:object, isMultiple:boolean, uid:string)=>Promise<object>;
type tAddAuthQry=(udata:object)=>Promise<object>;
type tAfterInq=(inqData:object)=>Promise<object>;

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
    const { changePassword, createDefaultUser, Login, updateProfile, updateLastLogin } = model;
    // const CaptchaCache = {};
    const rtr = Router();

    rtr.post('/login', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { username, password, token, captcha } = body;
            if (!CaptchaCache[`${token}`]) throw new Error("Captcha expired!");
            const { timer, value } = CaptchaCache[`${token}`];
            if (value !== captcha) throw new Error('Captcha Invalid');
            clearTimeout(timer);
            delete CaptchaCache[`${token}`];
            try {
                const [token, udata] = await Login(username, password);

                await updateLastLogin(udata)
                createLog(udata._id, `Login Success For User ${username}`, req);
                return token;
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


    rtr.post('/profile', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            // console.log(body);
            const { _id, username } = res.locals.udata;
            createLog(_id, `Update Profile for ${username}`, req);
            return await updateProfile(_id, body);
        });
    });

    rtr.post('/changePassword', (req, res) => {
        CtrlHandler(req, res, async (body) => {
            const { username, _id } = res.locals.udata;
            const { password, current } = body;
            await changePassword(username, current, password);
            createLog(_id, `Change password for ${username}`, req);
            return password;
        });
    });

    return rtr;
}
