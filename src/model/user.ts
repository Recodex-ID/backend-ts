import CreateUserController from './base_users';
import USRSCH from '../schema/user';
import {signer} from '../library/signer';

export default CreateUserController(USRSCH, 'SALT', signer);