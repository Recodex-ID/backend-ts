import express, { json } from 'express'; 
import { getConfigFile, getOsPlatform } from './library/config';
import router from './router';
import dotenv from 'dotenv';

dotenv.config();

const {server:{bind, port},} = getConfigFile();
const app = express();

app.listen(port, bind, async()=>{
    console.log("Listened", port, bind);
    const platform = getOsPlatform();
    console.log(platform)
})

app.use(json({limit:'10MB'}))
app.use(router);

app.use((req, res)=>{
    res.json({error:404, message:"Page not found!"})
})