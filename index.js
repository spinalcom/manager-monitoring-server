/*
 * Copyright 2023 SpinalCom - www.spinalcom.com
 * 
 * This file is part of SpinalCore.
 * 
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 * 
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 * 
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */


const { exec } = require("child_process");
const os = require('os');
const getmac = require('getmac').default;
const axios = require('axios');
const config = require('./config');
const querystring = require('querystring');
const fs = require('fs');
const cron = require('node-cron');
const { log } = require("console");
const { exitCode } = require("process");

cron.schedule('*/1 * * * *', async () => {
  await m();
});

async function m() {
  const checkDiskSpace = require('check-disk-space').default;
  const ddObject = await checkDiskSpace(__dirname);
  const DD = ddObject.size;
  const mac = getmac();
  fs.readFile("/proc/meminfo", 'utf8', (err, data) => {
    if (err) {
      console.error('Erreur de lecture du fichier :', err);
      return;
    }
    let stdoutData = '';
    const childProcess = exec("uptime -s", async (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur lors de l'exécution de la commande : ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Erreur de sortie standard : ${stderr}`);
        return;
      }
      const MemTotal = ((/(?<name>MemTotal): *(?<value>\d+).(?<unit>\w+)/g.exec(data))[2]) / 1048576;
      const MemFree = ((/(?<name>MemFree): *(?<value>\d+).(?<unit>\w+)/g.exec(data))[2]) / 1048576;
      const Cached = ((/(?<name>Cached): *(?<value>\d+).(?<unit>\w+)/g.exec(data))[2]) / 1048576;
      const Buffers = ((/(?<name>Buffers): *(?<value>\d+).(?<unit>\w+)/g.exec(data))[2]) / 1048576;
      const SwapTotal = ((/(?<name>SwapTotal): *(?<value>\d+).(?<unit>\w+)/g.exec(data))[2]) / 1048576;
      const used = (MemTotal - MemFree - (Cached + Buffers));
      const reboot = new Date(stdout.trim()).getTime();
      const objBosFile = {
        infoServer: {
          mac: mac,
          reboot: parseFloat(reboot),
          ram: parseFloat(used),
          cache: parseFloat(Cached),
          swap: parseFloat(SwapTotal),
          DD: parseFloat(((ddObject.size / 1048576) - (ddObject.free / 1048576))),
          flux: 2,
        }
      };
      console.log(objBosFile);
      const rep = await post("http://localhost:5050/servers/pushDataServer", objBosFile);

    });


    let valeurRetour = null; // Variable pour stocker la valeur retournée
    function afficherDateActuelle() {
      intervalID = setInterval(() => {
        const dateActuelle = new Date();
        valeurRetour = dateActuelle;
      }, 10000); // Répétition toutes les 10 secondes (10000 millisecondes)
    }
    afficherDateActuelle();
    // setTimeout(() => {
    //   console.log('Valeur retournée :', valeurRetour);
    // }, 30000); // Par exemple, après 30 secondes
  });
}
m();

async function post(url, data) {
  const config = await getConfig();
  return axios.post(url, data, config);
}

async function getConfig() {
  const token = await getToken();
  return {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "x-access-token": token
    }
  };
}


async function getToken() {
  try {
    const url_auth = config.monitoringApiConfig.monitoring_url + '/users/login';
    const response = await axios.post(url_auth,
      querystring.stringify({ email: config.monitoringApiConfig.email, password: config.monitoringApiConfig.password }));
    const token = response.data.token;
    const expire_in = response.data.expieredToken * 1000; // convert to ms
    const obtained_time = new Date().getTime();
    return token;
  } catch (error) {
    console.error(error);
    throw (error);
  }
}




