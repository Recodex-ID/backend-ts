import { createAuthController } from './utils';
import UserModel from '../model/user';
import {decode} from '../library/signer';

const refToken = (aToken: string)=>aToken;
const rtr=createAuthController(UserModel, decode, refToken, {});

export default rtr;