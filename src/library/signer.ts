import fs from 'fs';
import BaseSigner from './base_signer';

const privateKey=fs.readFileSync('./key/private.pem');
const publicKey=fs.readFileSync('./key/public.pem');
const signerOptions= {expiresIn:'5h', audience:'HKNet', subject:'hknet@edifly-si.sys', algorithm:'RS256'};

const sign = BaseSigner(privateKey, publicKey, signerOptions);

export const {decode, refreshToken, signer, verifyToken} = sign;
