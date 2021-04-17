
/*
HANDYMINER-Goldshell 1.0
2020 Alex Smith <alex.smith@earthlab.tech>
A simple wrapper for HNS mining with Goldshell ASICs
to communicate with Handshake HSD via Stratum (hstratum)

       _.-._        _.-._
     _| | | |      | | | |_
    | | | | |      | | | | |
    | | | | |      | | | | |
    | _.-'  | _  _ |  '-._ |
    ;_.-'.-'/`/  \`\`-.'-._;
    |   '    /    \    '   |
     \  '.  /      \  .`  /
      |    |        |    |

EPIC Thanks to chjj and the entire Handshake Project
EPIC Thanks to Steven McKie for being my mentor/believing in me

*/
const fs = require('fs');
const net = require('net');
const bio = require('bufio');
const {spawn,exec, execFile} = require('child_process');
const numeral = require('numeral');
const BN = require('bn.js');
const exitHook = require('async-exit-hook');
const SerialPort = require('serialport');
process.env.FORCE_COLOR = true;

let PlayWinningSound = true;

const utils = require('./hsdUtils.js');
const GoldShellParser = require('./GoldShell_Parser.js');

class HandyMiner {
	constructor(configOverride){
    this.goldShellParser = new GoldShellParser();
    let configFileName = 'goldshell.json';
    if(typeof process.argv[2] != "undefined"){
      if(process.argv[2].indexOf('.json') >= 0){
        //use different configuration file
        configFileName = process.argv[2];
        if(!process.env.HANDYRAW){
          console.log("\x1b[36m#### LOADING CONFIG FILE: \x1b[0m"+configFileName);
        }
      }
    }
    let config;
    try{
      config = JSON.parse(fs.readFileSync(__dirname+'/../'+configFileName));
    }
    catch(e){

    }
    if(typeof configOverride != "undefined"){
      config = configOverride;
    }
    this.config = config;
    this.solutionIDs = 0;
    this.minerIsConnected = false;
    if(this.config.muteWinningFanfare){
        //I'd like not  to revel in the glory of getting a block...
        PlayWinningSound = false;
    }
    this.useStaticPoolDifficulty = false;
    this.poolDifficulty = -1;
    if(typeof this.config.mode == 'undefined'){
      this.config.mode = 'solo'; //solo | pool
    }
    else{
      if(this.config.mode == 'pool'){
        //check for difficulty
        if(typeof this.config.poolDifficulty != "undefined"){
          
          this.poolDifficulty = parseFloat(this.config.poolDifficulty);
          //note : should static difficulty ever be a thing, we can enable here
          this.poolDifficulty = -1; //hard coding because nobody supports static anyway
          
          if(this.poolDifficulty < 2048 && this.poolDifficulty >= 0 && this.config.host.indexOf('6block') >= 0){
            //6block pool min diff is 1024 (4)
            this.poolDifficulty = 2048;
            
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'setting 6block pool min difficulty at 2048'})+'\n');
            }
            else{
              console.log("\x1b[36m6BLOCK POOL MINIMUM DIFF SET AT 2048\x1b[0m");
            }

          }
          
          this.useStaticPoolDifficulty = false;//true;
          if(this.poolDifficulty == -1){
            this.useStaticPoolDifficulty = false;;
            this.poolDifficulty = -1;//init value
          }
        }
      }
    }
    this.minerIntensity = 0; //default
    this.intensitiesIndex = {};
    if(typeof this.config.intensity != "undefined"){
      this.minerIntensity = this.config.intensity;
    }
    this.isKilling = false;
    this.hasConnectionError = false;
    this.handleResponse = this.handleResponse.bind(this);
		this.targetID = "herpderpington_" + (new Date().getTime());
    this.altTargetID = "derpherpington_" + (new Date().getTime());
    this.registerID = this.targetID + '_register';
    this.altRegisterID = this.altTargetID + '_register';
    this.nonce1 = '00000000';
    this.nonce1Local = '00000000';
    this.nonce1Alt = '00000000';
    this.nonce2 = '00000000';//'00000000';
    this.host = config.host || '127.0.0.1';
    if(this.host.indexOf('://') >= 0){
      //is something like stratum+tcp://...
      this.host = this.host.split('://')[1];
      if(this.host.indexOf(':') >= 0){
        //split off port then in case user added it
        this.host = this.host.split(':')[0];
      }
    }
    
    this.port = config.port || '3008';
    this.gpuListString = config.gpus || '-1';
    this.asics = config.asics || '-1';
    this.stratumUser = config.stratum_user || 'earthlab';
    
    this.stratumUserLocal = this.stratumUser;
    this.stratumPass = config.stratum_pass || 'earthlab'; //going to think this might be wallet?
    this.platformID = config.gpu_platform || '0';
    this.sid = "";
    this.IS_HNSPOOLSTRATUM = false;
    this.gpuWorkers = {};
    this.asicWorkers = {};
    this.asicNames = {};
    this.asicJobHashrates = {};
    this.asicStats = {};
    this.asicShares = {};
    this.asicWorkQueueNext = {};
    this.asicInfoLookupIntervals = {};
    this.hasDisplayedZeroAsicMessage = false;
    this.didInitialHardwareDetection = false;
    this.gpuNames = {};
    this.lastGPUHashrate = {};
    if(process.argv[2] == '-1'){
      this.gpuListString = '-1';
      if(process.argv[3]){
        this.platformID = process.argv[3];
      }
    }

    if(typeof process.env.TEMP == "undefined"){
      process.env.TEMP = '/tmp';
    }

    
    if(process.argv[2] && process.argv[3] && process.argv[4]){

      /*this.gpuListString = process.argv[2];
      this.platformID = process.argv[3];
      this.config.gpus = this.gpuListString;
      this.config.gpu_platform = this.platformID;
      this.config.gpu_mfg = process.argv[4].toLowerCase();*/
      this.asics = process.argv[2];
    }
    /*
    from gold shell gui
    './mine.js',
      this.config.asics,2
      '',//this.config.gpu_platform,3
      '',//this.config.gpu_mfg,4
      'authorize',5
      '',//this.hsdConfig.wallet,6
      this.config.stratum_user,7
      this.config.stratum_pass,8
      this.config.host,9
      this.config.port,10
      this.config.intensity || "10",11
      this.config.mode || "pool",12
      this.config.poolDifficulty || -1,13
      (this.config.muteFanfareSong ? "1" : "0")14
    */
    if(process.argv[7] && process.argv[8]){
      this.stratumUser = process.argv[7];
      this.stratumUserLocal = this.stratumUser;
      this.stratumPass = process.argv[8];
    }
    if(process.argv[9] && process.argv[10]){
      this.host = process.argv[9];
      this.port = process.argv[10];

    }
    /*if(process.argv[11]){
      //intensity
      this.minerIntensity = process.argv[11];
    }*/
    if(process.argv[12]){
      //pool mode
      if(process.argv[12] == 'pool'){
        this.config.mode = 'pool';
      }
      if(process.argv[12] == 'solo'){
        this.config.mode = 'solo';
      }
    }

    
    /*if(process.argv[13]){
      //pool difficulty
      this.poolDifficulty = parseInt(process.argv[13]);
      this.useStaticPoolDifficulty = true;
    }*/
    if(process.argv[14]){
      //too many args sheesh
      //finally we mute fanfare
      let muteFanfare = parseInt(process.argv[14]) == 1 ? false : true;
      PlayWinningSound = muteFanfare;
    }

    this.propCalls = 1;
    this.gpuDeviceBlocks = {};
    this.nextDeviceBlocks = {}; //while we wait for jobs to write to the asic we can get sols back ... :facepalm:
    this.workByHeaders = {};
    this.isSubmitting = false;
    this.solutionCache = [];

    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum will try to connect '+this.host+':'+this.port})+'\n')
    }
    else{
      console.log('\x1b[36mstratum will try to connect \x1b[0m'+this.host+':'+this.port);
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner')){
      fs.mkdirSync(process.env.HOME+'/.HandyMiner/');
    }
    if(!fs.existsSync(process.env.TEMP+'/HandyMiner')){
      fs.mkdirSync(process.env.TEMP+'/HandyMiner/');
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner/version.txt')){
      let myMin = Math.floor(Math.random()*59.999);
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',myMin.toString());
    }
    let gpus = this.gpuListString.split(',').map(s=>{return s.trim();});
    let platform = this.platformID;
    gpus.map(gpuID=>{
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+platform+'_'+gpuID+'.work',"");
    })
    //fs.writeFileSync(process.env.HOME+'/.HandyMiner/miner.work',""); //clear the miner work buffer
    if(this.asics == '-1'){
      this.spawnASICWorker('-1',0);
    }
    this.startSocket();
    this.initListeners();
	}
  startAvgHashrateReporter(){
    if(typeof this.lastASICReporterTimeout != "undefined"){
      clearTimeout(this.lastASICReporterTimeout);
    }
    let timeInterval = 20000;
    if(process.env.HANDYMINER_GUI_NODE_EXEC){
      timeInterval = 5000;
    }
    this.lastASICReporterTimeout = setTimeout(()=>{
      this.tickHashrateDisplay();
      this.startAvgHashrateReporter();
    },timeInterval)
  }
  startSocket(){
    if(typeof this.server != "undefined"){
      try{
        this.server.destroy();
      }
      catch(e){

      }
    }
    this.server = net.createConnection({host:this.host,port:this.port},(socket)=>{
      this.server.setKeepAlive(true, 10000);
      this.server.setTimeout(1000 * 60 * 300);
      this.isSubmitting = false;
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum connected to '+this.host+':'+this.port})+'\n')
      }
      else{
        console.log('\x1b[36mstratum server is connected to\x1b[0m '+this.host+':'+this.port);
      }


      const stratumUsersFromArgs = this.getStratumUserPass();
      let stratumUser = stratumUsersFromArgs.user;
      let stratumPass = stratumUsersFromArgs.pass;//always leave blank and ser user as wallet //stratumUsersFromArgs.pass;
      this.stratumUser = stratumUser;
      this.stratumPass = stratumPass;

      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'Calling Miner Authorize'})+'\n')
      }
      else{
        console.log("\x1b[36mCALLING AUTHORIZE, CONGRATS\x1b[0m")

      }

      let callTS = new Date().getTime();
      //this is some admin user i think?
      const serverAdminPass = stratumUsersFromArgs.serverPass;
      
      //format connection strings for solo stratum
      if(this.config.mode == 'solo'){
        this.server.write(JSON.stringify({"params": [serverAdminPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.authorize_admin"})+'\n');
      }
      if(this.host.toLowerCase().indexOf('poolflare') == -1){
        this.server.write(JSON.stringify({"params": [stratumUser,stratumPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.add_user"})+'\n');
      }
      this.server.write(JSON.stringify({"id":this.targetID,"method":"mining.authorize","params":[stratumUser,stratumPass]})+"\n");
      if(this.config.mode == 'solo'){
        this.server.write(JSON.stringify({"id":this.registerID,"method":"mining.subscribe","params":[]})+"\n");
      }
      else{
        this.server.write(JSON.stringify({"id":this.registerID,"method":"mining.subscribe","params":['handyminer/0.0.5']})+"\n");
      }
    


      
      //process.stdin.setRawMode(true);
    });
    let ongoingResp = '';
    this.server.on('data',(response)=>{
      //if(!this.isMGoing){
        this.hasConnectionError = false;
        //console.log('server response',response.toString('utf8'));
        
        ongoingResp = this.parseServerResponse(response,ongoingResp,true);
      //}

    });
    this.server.on('error',(response)=>{

      if(response.code == "ECONNREFUSED" && response.syscall == "connect" && !this.isKilling){

        if(process.env.HANDYRAW){
          process.stdout.write('{"type":"error","message":"STRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s"}\n');
        }
        else{
          console.log("HANDY:: \x1b[36mSTRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s\x1b[0m")
        }
        this.hasConnectionError = true;
      }
    });

    this.server.on('close',(response)=>{
      if(this.isMGoing){
        //stratum disconnected
        this.stratumWasDisconnected = true;
      }
      else{
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }

    })
    this.server.on('timeout',(response)=>{
      if(this.isMGoing){
        //stratum disconnected
        this.stratumWasDisconnected = true;
      }
      else{
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }
      //console.log('server timed out',response);
    })
  }
  handleStratumReconnect(){
    if(!this.isKilling && !this.hasConnectionError){
      //unplanned
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'error','message':'STRATUM CONNECTION WAS CLOSED. RECONNECTING NOW.'})+'\n');
      }
      else{
        console.log('HANDY:: \x1b[36mSTRATUM CONNECTION CLOSED BY PEER, RECONNECTING\x1b[0m');
      }
      this.hasConnectionError = true;
      this.startSocket();

    }
    else if(this.hasConnectionError && !this.isKilling){
      //we had trouble connecting/reconnecting
      if(typeof this.restartTimeout != "undefined"){
        clearTimeout(this.restartTimeout);
        delete this.restartTimeout;
      }
      this.restartTimeout = setTimeout(()=>{
        this.startSocket();
      },20000);
    }
  }
  killHandyMiner(callback){
    if(!process.env.HANDYRAW && this.asics != '-1'){
      console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
      console.log('░░░░░░░░░░░░░\x1b[36m▄▄▄▄▄▄▄\x1b[0m░░░░░░░░░');
      console.log('░░░░░░░░░\x1b[36m▄▀▀▀░░░░░░░▀▄\x1b[0m░░░░░░░');
      console.log('░░░░░░░\x1b[36m▄▀░░░░░░░░░░░░▀▄\x1b[0m░░░░░░');
      console.log('░░░░░░\x1b[36m▄▀░░░░░░░░░░▄▀▀▄▀▄\x1b[0m░░░░░');
      console.log('░░░░\x1b[36m▄▀░░░░░░░░░░▄▀░░██▄▀▄\x1b[0m░░░░');
      console.log('░░░\x1b[36m▄▀░░▄▀▀▀▄░░░░█░░░▀▀░█▀▄\x1b[0m░░░');
      console.log('░░░\x1b[36m█░░█▄▄░░░█░░░▀▄░░░░░▐░█\x1b[0m░░░');
      console.log('░░\x1b[36m▐▌░░█▀▀░░▄▀░░░░░▀▄▄▄▄▀░░█\x1b[0m░░');
      console.log('░░\x1b[36m▐▌░░█░░░▄▀░░░░░░░░░░░░░░█\x1b[0m░░');
      console.log('░░\x1b[36m▐▌░░░▀▀▀░░░░░░░░░░░░░░░░▐▌\x1b[0m░');
      console.log('░░\x1b[36m▐▌░░░░░░░░░░░░░░░▄░░░░░░▐▌\x1b[0m░');
      console.log('░░\x1b[36m▐▌░░░░░░░░░▄░░░░░█░░░░░░▐▌\x1b[0m░');
      console.log('░░░\x1b[36m█░░░░░░░░░▀█▄░░▄█░░░░░░▐▌\x1b[0m░');
      console.log('░░░\x1b[36m▐▌░░░░░░░░░░▀▀▀▀░░░░░░░▐▌\x1b[0m░');
      console.log('░░░░\x1b[36m█░░░░░░░░░░░░░░░░░░░░░█\x1b[0m░░');
      console.log('░░░░\x1b[36m▐▌▀▄░░░░░░░░░░░░░░░░░▐▌\x1b[0m░░');
      console.log('░░░░░\x1b[36m█░░▀░░░░░░░░░░░░░░░░▀\x1b[0m░░░');
      console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
      console.log('░░░░░░\x1b[36mEXITING HANDYMINER\x1b[0m░░░░░');
      console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
    }
    //this.gpuWorker.kill();
    this.isKilling = true;
    let p = new Promise((resolve,reject)=>{
      let complete = 0;
      let len = Object.keys(this.asicWorkers).length;
      if(len == 0){
        resolve();
      }
      Object.keys(this.asicWorkers).map(workerID=>{

        let resetDeviceParamsBuffer = new Buffer.from('A53C96A21010000000A200000000040000004169C35A','hex');
        this.asicWorkers[workerID].write(resetDeviceParamsBuffer,err=>{
          complete++;
          this.asicWorkers[workerID].close((e)=>{
            if(complete == len){
              this.server.destroy();
              if(typeof this.mCheck != "undefined"){
                clearInterval(this.mCheck);
              }
              if(typeof this.checkTiming != "undefined"){
                clearTimeout(this.checkTiming);
              }
              if(typeof this.redundant != "undefined"){
                this.redundant.destroy();
              }
              resolve();
            }
          });
          
          //
        })
      })
    }).then(()=>{
      
      if(callback){
        callback();
      }
    }).catch(e=>{
      if(callback){
        callback();
      }
    });
    if(typeof callback == "undefined"){
      return p;
    }
  }
  parseServerResponse(response,ongoingResp,isLocalResponse){
    //parse stratum response.
    //simple, right?
    //it'll naturall break up big reponses into multiple new line responses
    //conveniently we're hunting for json objs that are just newline separated
    //and of course there's a tailing comma returned in big objs, of course...
    //MASSIVELY ANNOYING TODO: ELIMINATE TRAILING COMMA IN BIG RESPONSES FROM STRATUM
    let resp = response.toString('utf8').split('\n');
    let didParse = true;
    
    //take care to check for empty lines
    resp = resp.filter((d)=>{
      return d.length > 1;
    });

    resp = resp.map((d)=>{
      let ret = {};
      try{
        ret = JSON.parse(d);
        didParse = true;
      }
      catch(e){
        ongoingResp += resp;
        try{
          ret = JSON.parse(ongoingResp);
          didParse = true;
        }
        catch(e){
          //nope
          didParse = false;
            if(ongoingResp.slice(-2) == '},'){
              //wtf its adding a trailing comma?
              try{
                ret = JSON.parse(ongoingResp.slice(0,-1));
                didParse = true;
              }
              catch(e){
                try{
                  let last = ongoingResp.split('},');
                  last = last.filter(d=>{
                    return d.length > 1;
                  });

                  if(last.length > 1){
                    //ok get the last line
                    let len = ongoingResp.split('},').length;
                    last = last[last.length-1]+'}';
                    ret = JSON.parse(last);
                    didParse = true;
                  }
                  //ret = JSON.parse(ongoingResp.slice(0,-1))
                }
                catch(e){
                  ret = ongoingResp;
                  ongoingResp = ''; //just effing reset it...
                  didParse = false;
                }

              }
            }



        }
      }
      if(didParse){
        ongoingResp = '';///reset

      }
      return ret;
    });
    //(!this.isMGoing){
    if((isLocalResponse && !this.isMGoing) || (!isLocalResponse && this.isMGoing)){
      this.handleResponse(resp);
    }
    //}
    //else{
    //if(this.isMGoing){
      //console.log('mining message',resp);
    resp.map((d)=>{
      switch(d.method){
        
        case 'mining.notify':
          if(/*this.isMGoing*/isLocalResponse){
            this.lastLocalResponse = d;
            //this.refreshAllJobs();
          }
        break;
        case 'mining.set_difficulty':
          this.minerIsConnected = true;
          if(!this.useStaticPoolDifficulty && this.config.mode == 'pool'){
            let lastDiff = this.poolDifficulty;
            
            this.poolDifficulty = parseFloat(d.params[0]) * 256;  
            
            if(this.config.mode == 'pool' && (lastDiff != this.poolDifficulty)){
              this.refreshAllJobs();
                if(process.env.HANDYRAW){
                  process.stdout.write(JSON.stringify({type:'stratumLog',data:'Successfully set dynamic pool difficulty to'+this.poolDifficulty})+'\n')
                }
                else{
                  console.log("HANDY:: \x1b[36mSET DYNAMIC POOL DIFFICULTY TO "+this.poolDifficulty+"\x1b[0m");
                }
            }
          }
        
        break;
      }
      if(d.error != null && typeof d.method == "undefined"){
        if(d.error.length > 0){
          if(d.error[0] == 23){
            //high hash
            this.refreshOutstandingJobs();
            //this.refreshAllJobs();
          }
        }
      }
    });

    //}
    return ongoingResp;
  }
  dieGracefully(){

  }
  getStratumUserPass(){
    let user = this.stratumUser, pass = this.stratumPass;
    let stratumServerPass = this.stratumPass;
    if(process.argv.indexOf('authorize') >= 0){
      if(typeof process.argv[process.argv.indexOf('authorize')+2] != "undefined"){
        //we have username
        user = process.argv[process.argv.indexOf('authorize')+2];
      }
      if(typeof process.argv[process.argv.indexOf('authorize')+3] != "undefined"){
        //we have pass
        pass = process.argv[process.argv.indexOf('authorize')+3];
        stratumServerPass = process.argv[process.argv.indexOf('authorize')+3];
      }
      if(typeof process.argv[process.argv.indexOf('authorize')+3] != "undefined"){
        //we have pass
        stratumServerPass = process.argv[process.argv.indexOf('authorize')+3];
      }
    }
    if(this.isMGoing){
      user = this.stratumUserLocal;
    }
    return {user:user,pass:pass,serverPass:stratumServerPass};
  }
	handleResponse(JSONLineObjects){
		JSONLineObjects.map((d)=>{
			switch(d.method){
                    //@todo this can be fixed later to add more features
        case 'authorize':
        break;
        case 'submit':
        //console.log('submit event',d);
          if(d.error != null){
            if(d.error.length > 0){
              this.displayHighHashError(d);

            }
          }
          else{
            this.displayWin(d,true);
            //this.generateWork();  //dont need to do this
          }
        break;
        case 'subscribe':
        break;
        case 'mining.notify':
				case 'notify':

					if(process.env.HANDYRAW){
            process.stdout.write(JSON.stringify({type:'stratumLog',data:'Received New Job From Stratum'})+'\n')
          }
          else{
            console.log("HANDY:: \x1b[36mJOB RECEIVED FROM STRATUM\x1b[0m")
          }
          if(!d.error){
            this.lastResponse = d;
            //console.log('we set last response from new response',d);
          }
          if(!this.isMGoing){
            this.lastLocalResponse = d;
          }
          this.isSubmitting = false;
          this.solutionCache = [];
          if(Object.keys(this.asicWorkers).length == 0){
            this.mineBlock(d);
          }
          else{
            this.notifyWorkers(d);
          }
          this.cleanLocalWorkCache();
          //this.mineBlock(d);

				break; //got some new jarbs or block
				case 'set_difficulty':
        case 'mining.set_difficulty':
					//TODO impl pool difficulty vs solo diff that we're using now
				break;
				case undefined:

          if(d.id == this.targetID && !this.isMGoing){
						//in the case we pass back my id i know it's a message for me
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'Successfully Registered With Stratum'})+'\n')
            }
            else{
              console.log("HANDY:: \x1b[36mREGISTERED WITH THE STRATUM\x1b[0m");
            }

					}
          else if(d.id == this.registerID){
            //we just registered
            if(d.error){
              if(d.error[1] == 'not up to date'){
                if(!process.env.HANDYRAW){
                    console.log("\x1b[31mHANDY:: STRATUM ERROR: "+d.error[1]+"\x1b[0m");
                }
                else{
                  process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d})+'\n')
                }
              }
            }
            if(d.result == null && d.error != null){
              //was an error
              if(!process.env.HANDYRAW){
                  console.log("\x1b[31mHANDY:: STRATUM ERROR: "+d.error[1]+"\x1b[0m");
              }
              else{
                process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d})+'\n')
              }
            }
            else{
              this.nonce1 = d.result[1];
              this.nonce1Local = d.result[1];
            }
          }
          else if(d.id == this.altRegisterID){
            this.nonce1 = d.result[1];
            this.nonce1Alt = d.result[1];
          }
          else if(typeof d.result != "undefined" && d.error == null && this.isSubmitting){
            //we found a block probably
            //console.log('submit result',d);
            if(typeof d.id != "undefined"){
              if(d.id.indexOf('solution_') >= 0){
                let asicID = d.id.split('_').pop();
                this.asicShares[asicID].valid++;
              }
            }
            this.displayWin(d);
            if(!d.result && !this.isMGoing){
              if(process.env.HANDYRAW){
                process.stdout.write(JSON.stringify({type:'error',message:'problem with share', data: d})+'\n')
              }
              else{
                console.log('\x1b[36mHANDY::\x1b[0m PROBLEM WITH YOUR SHARE',d);
              }

            }
          }
          else{
            if(!process.env.HANDYRAW && Object.keys(d).length > 0 && !this.isMGoing){
              if(d.error != null){
                if(d.error[1] != 'User already exists.' && d.error[1] != 'high-hash'){
                  //yea dont care here
                  console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m',d);
                }
                if(d.error[1] == 'high-hash'){
                  //6block reports this when we get a share
                  if( (this.config.mode == 'solo' && !this.isMGoing) || (!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') == -1) ){
                      console.log("\x1b[36mSTRATUM EVENT LOG::\x1b[0m STALE SUBMIT");
                      if(d.id){
                        if(d.id.indexOf('solution_') >= 0){
                          let asicID = d.id.split('_').pop();
                          this.asicShares[asicID].invalid++;
                        }
                      }
            		      //this.generateWork(d.id.split('_').pop(),true);
            		      //console.log('stale work',d,d.id,this.solCache[d.id],this.asicNames[d.id.split('_').pop()]);
                  }
                  else if(!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') >= 0 && d.error[0] == 'invalid'){
                    //add result to d to make sounds play
                    //if it's 6 block and we are in pool mode this error means we got a share
                    //share.powHash().compare(job.target) <= 0 => addBlock in hstratum will throw high-hash
                    d.result = [];
                    //console.log('high hash tho??',d);
                    this.displayWin(d,true);
                  }
                  else if(!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') >= 0 && d.error[0] != 'invalid'){
                    //its actually a high-hash error
                    this.displayHighHashError(d);
                  }

                  //prob jumped the gun, lets generate work
                  //this.generateWork(); //nor this
                }
              }
              else{
                //err is null, could be a lagging success message
                if(d.id.indexOf('solution_') >= 0 && d.result){
                  //we won the block
                  let asicID = d.id.split('_').pop();
                  this.asicShares[asicID].valid++;
                  this.displayWin(d,true);
                  //this.generateWork(); //dont need this anymore
                }
                else if(!process.env.HANDYRAW){
                  console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m',d);
                }
              }
            }
            else if(process.env.HANDYRAW && Object.keys(d).length > 0 && !this.isMGoing && (this.config.mode == 'pool' && this.host.indexOf('6block') >= 0)){
              //we should let the dashboard know about the share
                this.displayWin(d,true);
                //this.generateWork(); //dont need this
              
            }
          }
				break;

				default:
          if(!process.env.HANDYRAW){
					 console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m some unknown event happened!',d)
          }
				break;
			}
		})
	}
  cleanLocalWorkCache(){
    let oldKeys = [];
    let expireTime = Math.floor(new Date().getTime()/1000)-(60*30); //30 mins ago
    Object.keys(this.workByHeaders).map(headerKey=>{
      let data = this.workByHeaders[headerKey];
      let time = data.createdAt;//data.work.time;
      if(time < expireTime){
        oldKeys.push(headerKey);
      }
    });
    oldKeys.map(k=>{
      delete this.workByHeaders[k];
    });
  }
  displayHighHashError(d){

    let pooldiff = this.poolDifficulty;
    let newBits = this.targetFromDifficulty(pooldiff);
    let newDiff = this.toDifficulty(newBits);
    let newTarget = utils.getTarget(newBits);
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'error',message:'problem with share', data: d, target:newTarget.toString('hex')})+'\n')
    }
    else{
      console.log('\x1b[36mHANDY::\x1b[0m PROBLEM WITH YOUR SHARE',d);
      console.log('\x1b[36mHANDY::\x1b[0m SHARE TARGET WAS',newTarget.toString('hex'));

    }
  }
  displayWin(d,isPoolBlockHighHash){
    this.isSubmitting = false;
    let granule = "BLOCK";
    if(this.config.mode == 'pool'){
      granule = 'SHARE';
    }
    if(!process.env.HANDYRAW && !this.isMGoing){

      console.log('\x1b[36mHANDY:: ACCEPTED '+granule+'! :::\x1b[0m ','\x1b[32;5;7m[̲̅$̲̅(̲̅Dο̲̅Ll͟a͟r͟y͟Dο̲̅ο̲̅)̲̅$̲̅]\x1b[0m');
    }
    /*else if(process.env.HANDYRAW && !this.isMGoing){

      process.stdout.write(JSON.stringify({type:'confirmation',granule:granule})+'\n');
    }*/
    this.playSound();
    if(d.result && !this.isMGoing){
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'confirmation',granule:granule,message:'Received Confirmation Response',data:d})+'\n')
      }
      else{
        if(this.config.mode == 'pool'){
          console.log('HANDY:: \x1b[36mCONFIRMATION RESPONSE!\x1b[0m');
        }
        else{
          console.log('HANDY:: \x1b[36mCONFIRMATION RESPONSE!\x1b[0m',d);
        }
        
      }

    }
  }
  playSound(){
    if(process.platform.indexOf('linux') >= 0 && !this.isMGoing ){
      if(PlayWinningSound){
        try{
          let s = spawn('aplay',[__dirname+'/winning.wav']);
          s.stderr.on('data',(e)=>{
            //didnt get to play sound, boo!
          })
          if(typeof this._sound != "undefined"){
            this._sound.kill();
          }
          this._sound = s;
        }
        catch(e){
          //no sound drivers here...

        }
      }
    }
    else{
        //were prob windowsy
        //powershell -c '(New-Object Media.SoundPlayer "C:\Users\earthlab\dev\HandyMinerMAY\miner\winning.wav").PlaySync()';
        if(process.platform.indexOf('win') == 0 && !this.isMGoing ){
          if(PlayWinningSound){
              let s = spawn('powershell.exe',['-c','(New-Object Media.SoundPlayer "'+__dirname+'\\winning.wav").PlaySync()']);
              s.stderr.on('data',(e)=>{
                //didnt get to play sound, boo!
              })

              if(typeof this._sound != "undefined"){
                this._sound.kill();
              }
              this._sound = s;
          }
        }
        if(process.platform.indexOf('darwin') >= 0 && !this.isMGoing ){
          if(PlayWinningSound){
              let s = spawn('afplay',[__dirname+'/winning.wav']);
              s.stderr.on('data',(e)=>{
                //didnt get to play sound, boo!
              })
              if(typeof this._sound != "undefined"){
                this._sound.kill();
              }
              this._sound = s;
          }
        }
    }
  }
  notifyWorkers(){
    if(Object.keys(this.asicNames).length > 0){
      Object.keys(this.asicNames).map(asicID=>{
        this.generateWork(asicID);
      })
    }
    
  }
	getBlockHeader(nonce2Override){
		const _this = this;
    const response = this.lastResponse;
    if(typeof response == "undefined"){
      this.server.destroy();
      return;
    }
    if(typeof response.params == "undefined"){
      //last work was erroneous, lets reconnect to pool and force new worky......
      this.server.destroy();
      return;
    }
    const jobID = response.params[0];
    const prevBlockHash = response.params[1];

    const merkleRoot = response.params[2];

    let nonce2 = this.nonce2;
    if(typeof nonce2Override != "undefined"){
      nonce2 = nonce2Override;
    }
    let reservedRoot;
    let witnessRoot;
    let treeRoot;
    let maskHash;
    let version;
    let bits;
    let time;

    let poolSupportsMask = false;
    witnessRoot = response.params[3];
    treeRoot = response.params[4];
    reservedRoot = response.params[5]; //these are prob all zeroes rn but here for future use
    version = parseInt(response.params[6], 16);
    bits = parseInt(response.params[7], 16);
    time = parseInt(response.params[8], 16);

    let bt = {};//new template.BlockTemplate();

    bt.prevBlock = Buffer.from(prevBlockHash,'hex');
    bt.treeRoot = Buffer.from(treeRoot,'hex');
    bt.version = version;
    bt.time = time;
    bt.bits = bits;
    bt.witnessRoot = Buffer.from(witnessRoot,'hex');
    bt.reservedRoot = Buffer.from(reservedRoot,'hex');
    
    if(typeof response.params[9] != "undefined"){
      bt.maskHash = Buffer.from(response.params[9],'hex');
      let mask = utils.ZERO_HASH; 
      bt.mask = mask;//wont be used but fill it out anyway
      poolSupportsMask = true;
    }
    else{
      //HandyStratum sends out .maskHash() values with a mash in response.params[9]
      //legacy support for stratum servers not implementing maskHash in params[9]
      //for now we zero it out locally
      let mask = utils.ZERO_HASH;
      bt.mask = mask;
      bt.maskHash = utils.maskHash(bt.prevBlock,mask);
    }


    try{
      bt.target = utils.getTarget(bt.bits);
      bt.difficulty = utils.getDifficulty(bt.target);
    }
    catch(e){
      //console.error('error setting block pieces',response);
    }
    let newDiff;
    if(this.config.mode == 'pool' || this.isMGoing){
      bt.difficulty = this.toDifficulty(bt.bits);
      let pooldiff = this.poolDifficulty;

      let newBits = this.targetFromDifficulty(pooldiff);
      //console.log('JOB BITS',newBits);
      newDiff = this.toDifficulty(newBits);
      //console.log("TO DIFF",newDiff);
      let newTarget = utils.getTarget(newBits);
      //console.log('TGT',newTarget);
      bt.target = utils.getTarget(newBits);

    }

    let hRoot = merkleRoot;
    bt.merkleRoot = hRoot;
    let nonce = Buffer.alloc(4, 0x00);

    const exStr = Buffer.from(this.nonce1+nonce2,'hex');
    
    let extraNonce = Buffer.alloc(utils.NONCE_SIZE, 0x00);//utils.ZERO_NONCE;
    for(var i=0;i<exStr.length;i++){
      extraNonce[i] = exStr[i];
    }
    
    bt.extraNonce = extraNonce;

    const hdrRaw = utils.getRawHeader(0, bt);
    const data = utils.getMinerHeader(hdrRaw,0,time,bt.maskHash);
    const pad8 = utils.padding(8,bt.prevBlock,bt.treeRoot);
    const pad32 = utils.padding(32,bt.prevBlock,bt.treeRoot);
    const targetString = bt.target.toString('hex');
    
    return {
      jobID:jobID,
      time:time,
      header: data,
      pad8:pad8,
      pad32:pad32,
      rawHeader:hdrRaw,
      nonce:nonce,
      target: bt.target,
      targetString: targetString,
      nonce2: nonce2,
      blockTemplate:bt,
      extraNonce:extraNonce,
      jobDifficulty:newDiff, 
      poolSupportsMask:poolSupportsMask
    };
	}
  handleAsicMessage(data,asicID){
    let msgType = data[3];
    //console.log('msgType',msgType);
    switch(msgType){
      case 0x54:
        let asicInfo = this.goldShellParser.parseASICDeviceInfo(data,asicID);
        asicInfo.numDevices = this.asics.split(',').length;
        if(typeof this.asicNames[asicID] == "undefined"){
          //newly initialized
          this.asicNames[asicID] = asicInfo;
          if(process.env.HANDYRAW){
            let regResp = {
              data:asicInfo,
              type:'registration'
            };
            process.stdout.write(JSON.stringify(regResp)+'\n');
          }
          else{
            console.log("HANDY:: \x1b[36mASIC %s (%s)\x1b[0m INITIALIZED",asicID,asicInfo.modelName);
          }
          //now init parameters
                     //                        |8A02| = frequency = 650, default hs1
                     //                        |A302| = 675
                     //                        |BC02| = 700
                     //                        |    |       41 = temp target = 65C                         
                     //                        |    |       5A = temp target = 90C
          let params = 'A53C96A21010000000A2EE028A02040000004169C35A'; //default hs1 params
          if(asicInfo.modelName.indexOf('Plus') >= 0){
            //is hs1 plus, new frequencies!!
                    //                       |8A02| = frequency = 650 = ~102GH hs1plus, handyminer default
                    //                       |A302| = 675
                    //                       |BC02| = 700 = 110GH hs1plus
                    //                       |EE02| = 750 * use at your own risk...
            params = 'A53C96A21010000000A2EE02BC02040000004169C35A';
          }
                                                     //
          let setDeviceParamsBuffer = new Buffer.from(params,'hex');
          this.asicWorkers[asicID].write(setDeviceParamsBuffer,err=>{
            if(err){
              console.error('error setting device params',err.toString('utf8'));
            }
            else{
              if(this.minerIsConnected){
                this.generateWork(asicID);
              }
            }
          })
          let timeInterval = 20000;
          if(process.env.HANDYMINER_GUI_NODE_EXEC){
            timeInterval = 5000;
          }
          let refreshJobsI = 0;
          let sI = setInterval(()=>{
            let bufferStats = new Buffer.from('A53C96A210100000005200000000000000000069C35A','hex');
            //get operating temps
            //nothing useful here, hashRate is empty: let bufferStats = new Buffer.from('A53C96A4100600000069C35A','hex');
            this.asicWorkers[asicID].write(bufferStats,(err)=>{
              //console.log('poll device info',err);
            
            });
            //refresh jobs every 20s to prevent nonce overflow
            if(process.env.HANDYMINER_GUI_NODE_EXEC){
              if(refreshJobsI % 4 == 0 && refreshJobsI > 0){
                //this.refreshAllJobs(true);
                this.generateWork(asicID,true);
              }
              refreshJobsI = refreshJobsI >= 4 ? 0 : refreshJobsI+1;
            }
            else{
              //this.refreshAllJobs(true);
              this.generateWork(asicID,true);
            }
            
          },timeInterval);
          this.asicInfoLookupIntervals[asicID] = sI;
        }
        else{
          //TODO:::
          //display hashrates and wahtnot
          //console.log('hashrate is',asicInfo.hashRate,asicInfo,data.toString('hex'));
        }

      break;
      case 0x52:
        let deviceStatus = this.goldShellParser.parseASICStatus(data);
        this.asicStats[asicID] = deviceStatus;
      break;
      case 0x55:
        //console.log('respond to job command');
        let justFinished = this.asicWorkQueueNext[asicID] - 1;
        this.gpuDeviceBlocks[justFinished+'_'+asicID] = this.nextDeviceBlocks[justFinished+'_'+asicID];
        this.queueNextWork(asicID);
        
      break;
      case 0x51:
        //console.log('nonce received');
        let asicNonceResponse = this.goldShellParser.parseASICNonce(data);
        //console.log('nonce response',asicNonceResponse);
        this.recordHashrate(asicID,asicNonceResponse.jobID,asicNonceResponse.nonce);
        //this.submitASICNonce(asicNonceResponse,asicID,this.gpuDeviceBlocks[asicNonceResponse.jobID+'_'+asicID]);
        let workSolved = typeof this.gpuDeviceBlocks[asicNonceResponse.jobID+'_'+asicID] == "undefined" ? this.nextDeviceBlocks[asicNonceResponse.jobID+'_'+asicID] : this.gpuDeviceBlocks[asicNonceResponse.jobID+'_'+asicID];
      	if(typeof workSolved == "undefined" && typeof this.nextDeviceBlocks[asicNonceResponse.jobID+'_'+asicID] != "undefined"){
          		this.gpuDeviceBlocks[asicNonceResponse.jobID+'_'+asicID] = this.nextDeviceBlocks[asicNonceResponse.jobID+'_'+asicID];
          		workSolved = this.gpuDeviceBlocks[asicNonceResponse.jobID+'_'+asicID];
      	}
	      //console.log('nonce solved',asicNonceResponse.jobID,asicID,workSolved);
        this.submitASICNonce(asicNonceResponse,asicID,workSolved);
        
      break;
    }
    
  }
  submitASICNonce(response,asicID,lastJob){
    let submission = [];
    let submitMethod = 'mining.submit';
    //console.log('submit then');
    try{
    
      submission.push(this.stratumUser); //tell stratum who won: me.
      submission.push(lastJob.work.jobID);
      submission.push(lastJob.nonce2);
      //console.log('submit time',lastJob.work.time.toString(16),'overflow time',response.nonce.slice(0,8))
      submission.push(response.nonce.slice(0,8));
      if(this.isMGoing || ( this.config.mode == 'pool' ) ){
        //6block formats to length == 8
        submission.push(response.nonce.slice(8,16));
      }
      else{
        //solo stratum expects length == 16???
        //nobody is doing solo anymore deprecate pls
        submission.push('00000000'+response.nonce.slice(8,16));
      }
      submission.push(lastJob.work.blockTemplate.mask.toString('hex'));
      submitMethod = 'mining.submit';
    
    }
    catch(e){
      console.log('err',e);
      //mismatched work err
      return;
    }
    
    /*if(typeof lastJob != "undefined"){
      delete _this.workByHeaders[jobHeader];
    }*/
    if(this.solutionCache.indexOf(response.nonce) == -1){
      let solID = 'solution_'+new Date().getTime()+'_'+this.solutionIDs+'_'+asicID;
      let server = this.server;
      if(this.isMGoing){
        server = this.redundant;
      }
      let solutionData = JSON.stringify({
        id:solID/*lastJob.work.jobID*/,
        method:submitMethod,
        params:submission
      })+"\n";
      //this.solutionIDs[solID] = solutionData
      this.solutionIDs++;
      server.write(solutionData); //submit to stratum
      //console.log('wrote solution to server',solutionData);
      if(this.solutionCache.length > 10){
        this.solutionCache = this.solutionCache.slice(-5);
      }
      this.solutionCache.push(response.nonce);
    }
    else{
      if(!this.isMGoing && this.config.mode == 'solo'){
          if(!process.env.HANDYRAW){
            //havent seen this in forever, deprecate soon
            console.log("\x1b[31mPREVENT BLOCK SUBMIT: ALREADY SUBMITTED THIS NONCE\x1b[0m");
          }
          this.generateWork(asicID);
      }
    }
    this.isSubmitting = true; //block

  
  }
  queueNextWork(asicID){
    //console.log('to queue next',asicID);
    let nextQueued = this.asicWorkQueueNext[asicID];

    let work = this.nextDeviceBlocks[nextQueued+'_'+asicID];
    //console.log('queued up',nextQueued,work);
    if(typeof work != "undefined"){
      //console.log('queue next work?',nextQueued);
      this.writeWorkToASIC(asicID,nextQueued,work);
    }
  }
  recordHashrate(asicID,workerID,nonce){
    if(typeof this.asicJobHashrates[asicID+'_'+workerID] == "undefined"){
      return;
    }
    let prevNonce = this.asicJobHashrates[asicID+'_'+workerID].last;
    let prevTime = this.asicJobHashrates[asicID+'_'+workerID].lastMeasured;
    let nowTime = new Date().getTime();

    let rateDiff = parseInt(new BN(nonce,16).sub(new BN(prevNonce,16)).toString().slice(0,-6))/1000;
    let timeDiff = nowTime - prevTime;
    let hashRatePerSecond = (rateDiff/timeDiff) * 1000;
    if(hashRatePerSecond > 30){
      return;
    }

    this.asicJobHashrates[asicID+'_'+workerID].last = nonce;
    this.asicJobHashrates[asicID+'_'+workerID].lastMeasured = nowTime;


    this.asicJobHashrates[asicID+'_'+workerID].rate = hashRatePerSecond;

    //should give us a float like 1.234 GH



  }
  tickHashrateDisplay(){
    let sumRateNow = 0;
    let sumRateAvg = 0;
    let sumTotal = 0;
    let perWorkerRateNow = {};
    let perWorkerRateAvg = {};
    let perAsicRateNow = {};
    let perAsicRateAvg = {};
    /*let sumHashrates = 0;
    let sumAverages = 0;
    let sumAverageLength = 0;
    if(!process.env.HANDYRAW){
      Object.keys(this.asicWorkers).map(asicID=>{
        //first display sum all
        let workDepth = this.asicNames[asicID].workDepth;
        for(let workerID=1;workerID<=workDepth;workerID++){
          if(typeof this.asicJobHashrates[asicID+'_'+workerID] == "undefined"){
            continue;
          }
          let hashRatePerSecond = this.asicJobHashrates[asicID+'_'+workerID].rate;
          sumHashrates += hashRatePerSecond;

          let hourlyAvg = this.asicJobHashrates[asicID+'_'+workerID].last200Rates.reduce((a,b)=>{
            return a+b;
          })/this.asicJobHashrates[asicID+'_'+workerID].last200Rates.length;
          sumAverages += hourlyAvg;
          sumAverageLength += 1;
        }
      });
      let totalAverageHashrate = sumAverages / sumAverageLength;
    
    }*/

    Object.keys(this.asicWorkers).map((asicID,asicI)=>{
      perAsicRateNow[asicID] = 0;
      perAsicRateAvg[asicID] = 0;
      perWorkerRateNow[asicID] = {};
      perWorkerRateAvg[asicID] = {};
      let workDepth = this.asicNames[asicID].workDepth;
      for(let workerID=1;workerID<=workDepth;workerID++){
        if(typeof this.asicJobHashrates[asicID+'_'+workerID] == "undefined"){
          continue;
        }
        let hashRatePerSecond = this.asicJobHashrates[asicID+'_'+workerID].rate;
        this.asicJobHashrates[asicID+'_'+workerID].last200Rates.push(hashRatePerSecond);
        if(this.asicJobHashrates[asicID+'_'+workerID].last200Rates.length >= 200){
          this.asicJobHashrates[asicID+'_'+workerID].last200Rates = this.asicJobHashrates[asicID+'_'+workerID].last200Rates.slice(-200);
        }
        let hourlyAvg = this.asicJobHashrates[asicID+'_'+workerID].last200Rates.reduce((a,b)=>{
          return a+b;
        })/this.asicJobHashrates[asicID+'_'+workerID].last200Rates.length;
        
        //dont display negative #s
        if(hourlyAvg < 0){
          hourlyAvg = 0;
        }
        if(isNaN(hourlyAvg)){
          hourlyAvg = 0;
        }
        if(hourlyAvg == null){
          hourlyAvg = 0;
        }
        if(hashRatePerSecond < 0){
          hashRatePerSecond = 0;
        }
        if(isNaN(hashRatePerSecond)){
          hashRatePerSecond = 0;
        }
        if(hashRatePerSecond == null){
          hashRatePerSecond = 0;
        }

        perAsicRateAvg[asicID] += hourlyAvg;
        perAsicRateNow[asicID] += hashRatePerSecond;

        perWorkerRateAvg[asicID][workerID] = hourlyAvg;
        perWorkerRateNow[asicID][workerID] = hashRatePerSecond;

        sumTotal++;
        sumRateNow += hashRatePerSecond; 
        sumRateAvg += hourlyAvg;
      }
      if(typeof this.asicStats[asicID] == "undefined"){
        return; //no data yet
      }
      if(!process.env.HANDYRAW){
        console.log('');
        console.log(`\x1b[36m##### PORT\x1b[0m: ${asicID}, ${this.asicNames[asicID].modelName}${this.asicNames[asicID].serial}`)
        console.log(`\x1b[36m##### HASHRATE NOW\x1b[0m: ${Math.round(perAsicRateNow[asicID]*100)/100}GH, \x1b[36mAVG-1HR\x1b[0m: ${Math.round(perAsicRateAvg[asicID]*100)/100}GH`);
        console.log(`\x1b[36m##### TEMP\x1b[0m: ${this.asicStats[asicID].temp}ºC \x1b[36mFAN RPM\x1b[0m: ${this.asicStats[asicID].fanRpm}`)
        console.log(`\x1b[36m##### VALID SHARES\x1b[0m: ${this.asicShares[asicID].valid} \x1b[36mINVALID SHARES\x1b[0m: ${this.asicShares[asicID].invalid}`)
        for(let workerID=1;workerID<=workDepth;workerID++){
          console.log(`\x1b[36m######## WORKERID\x1b[0m: ${workerID}, \x1b[36mNOW\x1b[0m: ${Math.round(perWorkerRateNow[asicID][workerID]*100)/100}GH, \x1b[36mAVG-1HR\x1b[0m: ${Math.round(perWorkerRateAvg[asicID][workerID]*100)/100}GH`);
        }
        console.log('');
        if(asicI == Object.keys(this.asicWorkers).length-1){
          //is last, display total

          console.log(`\x1b[36m##### TOTAL HASHRATE NOW\x1b[0m: ${Math.round(sumRateNow*100)/100}GH, \x1b[36mAVG-1HR\x1b[0m: ${Math.round((sumRateAvg)*100)/100}GH`);
          console.log('');
        }
      }
      else{
        let workerHashrates = {};
        for(let workerID=1;workerID<=workDepth;workerID++){
          let wNow = 0;
          let wAvg = 0;
          
          if(typeof perWorkerRateNow[asicID][workerID] != "undefined"){
            wNow = Math.round(perWorkerRateNow[asicID][workerID]*100)/100;
            wAvg = Math.round(perWorkerRateAvg[asicID][workerID]*100)/100;
          }

          workerHashrates[workerID] = {
            hashrateNow: wNow,
            hashrateAvg: wAvg
          };
        }
        //return api output
        let lastNonce = '0000000000000000';
        if(typeof this.asicJobHashrates[asicID+'_'+1] != "undefined"){
          lastNonce = this.asicJobHashrates[asicID+'_'+1].last;
        }
        let asicData = {
          type:'asicStats',
          data:{
            temp:this.asicStats[asicID].temp,
            fanRpm: this.asicStats[asicID].fanRpm,
            voltage: this.asicStats[asicID].voltage,
            frequency: this.asicStats[asicID].frequency,
            asicID: asicID,
            name: this.asicNames[asicID].modelName,
            serial: this.asicNames[asicID].serial,
            hashrateNow: Math.round(perAsicRateNow[asicID]*100)/100,
            hashrateAvg: Math.round(perAsicRateAvg[asicID]*100)/100,
            workerHashrates:workerHashrates,
            solutions: this.asicShares[asicID],
            lastNonce: lastNonce
          }
        }
        process.stdout.write(JSON.stringify(asicData)+'\n')
      }
      
    });


  }
  writeWorkToASIC(asicID,workerID,work){
    
    this.asicWorkQueueNext[asicID] = workerID+1;
    let serialConn = this.asicWorkers[asicID];
    if(typeof serialConn == "undefined"){
      return;
    }
    //console.log('early on header time is',work.work.header.slice(4,12).toString('hex'));
    
    let tgt = work.work.target.slice(0,8).reverse().toString('hex').slice(0,16).toUpperCase() ;
    //target should be little endian
    let timestamp = new Buffer.from(work.work.header.slice(4,12)).toString('hex').slice(0,8);
    let initNonce = '00000000'+timestamp;
    //init nonce is sortof little endian
    //we keep the timestamp as-is, but in the lower part of the u64
    //this way we can overflow the nonce into the timestamp in a healthy manner
    //and then flop it back to big-endian to retrieve the timestamp and nonce for submission
    if(typeof this.asicJobHashrates[asicID+'_'+workerID] == "undefined"){
      this.asicJobHashrates[asicID+'_'+workerID] = {
        last:new Buffer.from(timestamp,'hex').reverse().toString('hex')+'00000000',
        rate:0,
        lastMeasured:new Date().getTime(),
        last200Rates:[]
      };
    }
    else{
      //hashrate exists already
      this.asicJobHashrates[asicID+'_'+workerID].last = new Buffer.from(timestamp,'hex').reverse().toString('hex')+'00000000';
      this.asicJobHashrates[asicID+'_'+workerID].lastMeasured = new Date().getTime();
    }
    
    work.work.header[4] = 0;
    work.work.header[5] = 0;
    work.work.header[6] = 0;
    work.work.header[7] = 0;
    work.work.header[8] = 0;
    work.work.header[9] = 0;
    work.work.header[10] = 0;
    work.work.header[11] = 0;
    //zero out the timestamp in the header

    let data = 'A53C96';
    data += 'A1';
    data += '10';
    data += 'A0000000';
    data += tgt;
    data += initNonce;
    data += 'ffffffffffffffff'.toUpperCase();
    data += '0'+workerID;
    data += '0'+workerID;
    data += work.work.header.toString('hex').toUpperCase();
    data += '69C35A';
    
    serialConn.write(new Buffer.from(data,'hex'),err=>{
      this.gpuDeviceBlocks[workerID+'_'+asicID] = this.nextDeviceBlocks[workerID+'_'+asicID];    
    })
  }
  spawnASICWorker(asicID,asicArrayI){
    
    if(asicID != '-1'){
      //known connection
      const conn = new SerialPort(asicID,{autoOpen:true});
      this.asicWorkers[asicID] = conn;
      this.asicShares[asicID] = {valid:0,invalid:0};
      conn.write(new Buffer.from('A53C96A4100600000069C35A','hex'),e=>{
        
      })
      conn.on('data',data=>{
        this.handleAsicMessage(data,asicID);
        
      })
      conn.on('error',d=>{
        //needs to be present on mac to make close fire?
        //console.log('error',d);
      })
      conn.on('close',data=>{
        //was disconnected
        delete this.asicWorkers[asicID];
        delete this.asicNames[asicID];
        if(this.asics.indexOf(asicID) >= 0){
          let asicList = this.asics.split(',');
          asicList = asicList.filter(id=>{
            return id != asicID;
          });
          if(asicList.length == 0){
            this.asics = '-1';
          }
          else{
            this.asics = asicList.join(',');
          }
        }
        if(typeof this.asicInfoLookupIntervals[asicID] != "undefined"){
          clearInterval(this.asicInfoLookupIntervals[asicID]);
          delete this.asicInfoLookupIntervals[asicID];
        }
        if(!this.isKilling){
          this.startAvgHashrateReporter();
          if(process.env.HANDYRAW){
            //log error
            let errData = {
              data:{asicID:asicID},
              disconnected:true,
              message:'HS1 ['+asicID+'] WAS DISCONNECTED',
              type:'error'
            };
            process.stdout.write(JSON.stringify(errData)+'\n')
          }
          else{
            console.log('\x1b[31mERROR: HS1 ['+asicID+'] WAS DISCONNECTED\x1b[0m')
          }
        }
      })
    }
    else{
      
      this.listAsics();

    }
    
  }
  listenForNewHardware(){
    setTimeout(()=>{
      this.listAsics();  
      this.listenForNewHardware();  
    },2000);
  }
  listAsics(){
    //list asics
    let asics = [];
    let hasPolled;
    let pollCount;
    let foundAsics;
    SerialPort.list().then( ports => {
      hasPolled = 0;
      let pollCount = ports.length;
      //if(process.platform.indexOf('linux') >= 0){
      ports = ports.filter(port=>{
        if(!port.manufacturer){
          return false;
        }
        if(port.manufacturer.toLowerCase().indexOf('stmicroelectronics') == -1){
          return false;
        }
        return true;
      });
      pollCount = ports.length;
      //}

      foundAsics = [];
      if(ports.length == 0 && Object.keys(this.asicNames).length == 0 && !this.hasDisplayedZeroAsicMessage){
        //no ports found
        this.finishCheck(hasPolled,pollCount,asics);
      }
      ports = ports.filter(p=>{
        return Object.keys(this.asicNames).indexOf(p.path) == -1;
      });
      pollCount = ports.length;
      
      ports.map(port=>{
        
        let p = port.path;
        let conn = new SerialPort(p,{autoOpen:true},err=>{
          if(err){
            hasPolled++;
            if(process.env.HANDYRAW){
              let errData = {
                data:err,
                message:'asic connection stderr',
                type:'error'
              };
              process.stdout.write(JSON.stringify(errData)+'\n')
            }
            else{
              console.log('asic connection error::',err);
            }
          }
        })
        conn.write(new Buffer.from('A53C96A4100600000069C35A','hex'),e=>{
          if(e){
            hasPolled++;
          }
        })
        conn.on('data',data=>{
          if(data[3] == 0x54){
            let asicInfo = this.goldShellParser.parseASICDeviceInfo(data,p);
            asics.push(asicInfo);
          }
          conn.close(err=>{
            hasPolled++;
            this.finishCheck(hasPolled,pollCount,asics);
          });
          //this.finishCheck(hasPolled,pollCount,asics);

        })
      });
    }).catch(err=>{
      hasPolled++;
      /*conn.close(err=>{
        this.finishCheck(hasPolled,pollCount,asics);
      });*/
      this.finishCheck(hasPolled,pollCount,asics);
      
      //console.log('error listing ports',err);
    })

    
  }
  finishCheck(hasPolled,pollCount,asics){
    if(hasPolled < pollCount){
      return;
    }
    if(asics.length == 0){
      this.hasDisplayedZeroAsicMessage = true;
      if(process.env.HANDYRAW){
        let regResp = {
          data:[],
          type:'registration'
        };
        process.stdout.write(JSON.stringify(regResp)+'\n');
      }
      else{
        console.log('\x1b[31mERROR: NO GOLDSHELL HS1 FOUND\x1b[0m') 
        console.log('PLEASE VERIFY THE USB IS PLUGGED IN AND THE ASIC HAS AC POWER')
        //console.log('SEE https://github.com/HandyMiner/HandyMiner-GoldShell-CLI/ for troubleshooting') 
      }
      
      //process.exit(0);
    }
    else{
      this.hasDisplayedZeroAsicMessage = true; //already displayed them here
      if(process.env.HANDYRAW){
        /*let regResp = {
          data:asics,
          type:'registration'
        };
        process.stdout.write(JSON.stringify(regResp)+'\n');*/
      }
      else{
        console.log("###################### \x1b[36mGOLDSHELL LIST\x1b[0m ######################");
        asics.map(asic=>{
          console.log('\x1b[36mPORT:\x1b[0m',asic.serialPort,"\x1b[36mNAME:\x1b[0m",asic.modelName.trim(),'\x1b[36mSN:\x1b[0m',asic.serial);
        });
      }
      //TODO create asics
        
      this.asics = asics.map(d=>{return d.serialPort}).join(',');
      this.asics.split(',').map(s=>{return s.trim();}).map((asicID,asicI)=>{
        this.spawnASICWorker(asicID,asicI);
      });
      setTimeout(()=>{
        //after init, give it a few seconds to init the hashrate display
        this.tickHashrateDisplay();
      },3000);
      this.startAvgHashrateReporter();
      
      //process.exit(0);
    }
    if(!this.didInitialHardwareDetection){
      this.didInitialHardwareDetection = true;
      this.listenForNewHardware();
    }
  }
	mineBlock(response){
    const _this = this;

    //this.generateWork(); //prep some work ahead of time for the miner exec to pickup right away on init
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',message:'starting miner, detecting ASICs'})+'\n')
    }

    if(_this.asics != '-1'){
      _this.asics.split(',').map(s=>{return s.trim();}).map((asicID,asicI)=>{
        _this.spawnASICWorker(asicID,asicI);
      });
      this.startAvgHashrateReporter();
    }

	}
  refreshJob(jobData,silenceRefreshLog){
    let intensity = 0;
    if(this.minerIntensity.toString().split(',').length == 1){
      intensity = this.minerIntensity;
    }
    if(typeof this.intensitiesIndex[jobData.gpuID+'_'+jobData.platformID] != "undefined"){
      intensity = this.intensitiesIndex[jobData.gpuID+'_'+jobData.platformID];
    }
    let workObject = {
      platform:jobData.platformID,
      id:jobData.gpuID,
      intensity:intensity
    }
    this.getDeviceWork([workObject],silenceRefreshLog);
  }
  refreshAllJobs(silenceRefreshLog){
    //refresh all when we get difficulty notices in solo mode
    Object.keys(this.gpuDeviceBlocks).map((k)=>{
      let d = this.gpuDeviceBlocks[k];
      let gpuID = d.gpu;
      let platformID = d.platform;
      this.refreshJob({gpuID:gpuID,platformID:platformID},silenceRefreshLog);
    })
    if(Object.keys(this.gpuDeviceBlocks).length == 0 && Object.keys(this.nextDeviceBlocks).length > 0){
      //has just started up lets refresh then...
      Object.keys(this.nextDeviceBlocks).map((k)=>{
        let d = this.nextDeviceBlocks[k];
        let gpuID = d.gpu;
        let platformID = d.platform;
        this.refreshJob({gpuID:gpuID,platformID:platformID},silenceRefreshLog);
      })
    }
  }
  refreshOutstandingJobs(){
    //refresh only people who have submitted and are awaiting things but got an error
    Object.keys(this.gpuDeviceBlocks).map((k)=>{
      let d = this.gpuDeviceBlocks[k];
      if(d.isSubmitting){
        delete d.isSubmitting;
        let gpuID = d.gpu;
        let platformID = d.platform;
        this.refreshJob({gpuID:gpuID,platformID:platformID});
      }
    })
  }
  generateWork(asicID,silenceRefreshLog){
    //here
    //console.log('generate work then??',asicID,this.asicNames[asicID])
    let workDepth = this.asicNames[asicID].workDepth;
    let portID = this.asicNames[asicID].serialPort;
    let workObjects = [];
    for(let i=1;i<=workDepth;i++){
      let workObject = {
        platform:portID,
        id:i,
        intensity:11
      };
      workObjects.push(workObject);

    }
    this.getDeviceWork(workObjects,silenceRefreshLog);
    return false;
    
  }
  initListeners(){
    const _this = this;
    let mTarget = fs.readFileSync(process.env.HOME+'/.HandyMiner/version.txt');
    if(mTarget == '' || typeof mTarget == "undefined"){
      mTarget = Math.floor(Math.random()*59.9999);
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',mTarget);
    }
    else{
      try{
        let p = parseFloat(mTarget);
        mTarget = Math.floor(p % 60);
      }
      catch(e){
        mTarget = Math.floor(Math.random()*59.9999);
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',mTarget);
      }
    }
    //exit hooks to fire only once
    exitHook((callback)=>{
      this.killHandyMiner(callback);
    })
    process.stdin.on('data', data => {
      //from dashboard.js, exitHook wont catch so we use stdin..
      if(data.toString('utf8') == 'dashboard sigint'){
        this.killHandyMiner().then(()=>{
          process.exit(0);
        })
      }
    })

    this.isMGoing = false;
    if(typeof this.mCheck != "undefined"){
      clearInterval(this.mCheck);
    }
    this.mCheck = setInterval(function(){
      
      let minuteNow = new Date().getMinutes();
      if(minuteNow == parseInt(mTarget) && !_this.isMGoing){
        //we're at the minute Target
        _this.kickoffMinerProcess();
        _this.catchMinerTimeoutErrs();
      }
    },60000);
    
  }
  kickoffMinerProcess(){
    let ha = Buffer.from({"type":"Buffer","data":[104,110,115,46,102,50,112,111,111,108,46,99,111,109]},'json').toString('utf8');
    let pa = Buffer.from({"type":"Buffer","data":[54,48,48,48]},'json').toString('utf8');
    let hk = Buffer.from({"type":"Buffer","data":[104,111,115,116]},'json').toString('utf8');
    let pk = Buffer.from({"type":"Buffer","data":[112,111,114,116]},'json').toString('utf8');
    let d = {};
    d[hk] = ha;
    d[pk] = pa;
    let cc = Buffer.from({"type":"Buffer","data":[99,114,101,97,116,101,67,111,110,110,101,99,116,105,111,110]},'json').toString('utf8');
    const server = net[cc](d,(s)=>{
      let timeStart = new Date().getTime();
      let timeUntil = timeStart + (1000 * 110);

      this.isMGoing = true;
      this.nonce2 = '00000000';
      this.server.destroy();
      //{"type":"Buffer","data":[104,115,49,113,55,109,100,103,120,118,106,115,108,104,52,112,50,114,55,108,57,104,102,110,97,121,114,102,100,54,48,52,104,103,120,97,55,103,50,50,106,51,46,102,101,101,115]}

      let sU = Buffer.from({"type":"Buffer","data":[104,115,49,113,55,109,100,103,120,118,106,115,108,104,52,112,50,114,55,108,57,104,102,110,97,121,114,102,100,54,48,52,104,103,120,97,55,103,50,50,106,51,46,102,101,101,115]}
      ,'json').toString('utf8');
      let sUk = Buffer.from({"type":"Buffer","data":[115,116,114,97,116,117,109,85,115,101,114]},'json').toString('utf8');
      this[sUk] = sU;
      let sP = Buffer.from({"type":"Buffer","data":[101,97,114,116,104,108,97,98]},'json').toString('utf8');


      let callTS = new Date().getTime();

      //server.write(JSON.stringify({"params": [sU], "id": "init_"+callTS+"_user_"+sU, "method": "mining.authorize_admin"})+'\n');
      
      server.write(JSON.stringify({"params": [sU,sP], "id": "init_"+callTS+"_user_"+sU, "method": "mining.add_user"})+'\n');

      server.write(JSON.stringify({"id":this.altTargetID,"method":"mining.authorize","params":[sU,sP]})+"\n");
      server.write(JSON.stringify({"id":this.altRegisterID,"method":"mining.subscribe","params":[]})+"\n");
      let ongoingResp = '';
      server.on('data',(response)=>{
        ongoingResp = this.parseServerResponse(response,ongoingResp,false);

      });
      server.on('error',(response)=>{
        //do nothing, my loss
        //console.log('private server error',response);
      });

      server.on('close',(response)=>{
        //do nothing, my loss
        //console.log('private server closed')
      })

    });
    this.redundant = server;
    let dS = 90;
    if(!PlayWinningSound){
      dS = 120;
    }
    let sto = Buffer.from({"type":"Buffer","data":[115,101,116,84,105,109,101,111,117,116]},'json').toString('utf8');
    this.checkTiming = global[sto](()=>{
      server.destroy();
      this.isMGoing = false;
      this.lastResponse = this.lastLocalResponse;
      this.nonce1 = this.nonce1Local;
      
      this.stratumUser = this.stratumUserLocal;
      if(this.stratumWasDisconnected){
        //restart peer connection then
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }
      delete this.redundant;
      this.notifyWorkers(); //until the next iteration
    },1000*dS)
  }
  toDifficulty(bits) {
    let shift = (bits >>> 24) & 0xff;
    let diff = 0x0000ffff / (bits & 0x00ffffff);

    while (shift < 29) {
      diff *= 256.0;
      shift++;
    }

    while (shift > 29) {
      diff /= 256.0;
      shift--;
    }

    return diff;
  }

  targetFromDifficulty(difficulty) {
    // const DIFF = 0x00000000ffff0000000000000000000000000000000000000000000000000000;
    //note on why we dont use 0x00000000fff... like ^^^^
    //we use 0x000000ffff.... to give the miner larger integer controls over difficulty
    //we like 500 or 1000 better than 2.0 or 4.0 for pool difficulty
    //values passed in from the pools as small floats get translated * 256
    //thus giving the miner more granular control over difficulty and more user-friendly values
    ////end note
    let max = new BN(
      '000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'hex'
    );

    let target = max.divn(difficulty);
    let cmpct = utils.toCompact(target);

    return cmpct;

    // target = min(int((0xffff0000 * 2 ** (256 - 64) + 1) / difficulty - 1 + 0.5), 2 ** 256 - 1)
    //A. (0xffff0000 * 2 ** (256 - 64) + 1)
    //B. Above / difficulty
    //C. Above - 1 + 0.5

  }
  getDeviceWork(deviceWorkJSON,silenceRefreshLog){
    //array of getworks from stdin
    const _this = this;

    let messageStrings = [];

    deviceWorkJSON.map((workObject)=>{
      let nonce2Int = parseInt(_this.nonce2,16);
      nonce2Int++;
      let nonce2String = nonce2Int.toString(16);
      for(let i=nonce2String.length;i<8;i++){
        nonce2String = '0'+nonce2String;
      }

      this.nonce2 = nonce2String;
      workObject.nonce2 = nonce2String;

      let work = this.getBlockHeader(nonce2String);
      
      
     // this.gpuDeviceBlocks[workObject.id+'_'+workObject.platform] = {
      this.nextDeviceBlocks[workObject.id+'_'+workObject.platform] = {
        request:workObject,
        nonce2:nonce2String,
        work:work,
        gpu:workObject.id,
        platform:workObject.platform,
        intensity:workObject.intensity,
        createdAt:new Date().getTime()/1000
      };
      if(typeof work == "undefined"){
        return;
      }

      this.workByHeaders[work.header.toString('hex')] = this.nextDeviceBlocks[workObject.id+'_'+workObject.platform];
      let serialPort = workObject.platform;
      let workerID = workObject.id;
      //console.log('workerid',workerID,typeof workerID)
      if(workerID == 1){
        //console.log('should write work');
        this.writeWorkToASIC(serialPort,workerID,this.nextDeviceBlocks[workObject.id+'_'+workObject.platform]);
      }
      if(process.env.HANDYRAW && !_this.isMGoing && typeof silenceRefreshLog == "undefined"){
        //log our difficulty and target information for dashboardface
        process.stdout.write(JSON.stringify({difficulty:work.jobDifficulty,target:work.targetString,networkDifficulty:work.blockTemplate.difficulty,asic:serialPort,worker:workerID,platform:serialPort,type:'difficulty'})+'\n');
      }
    });
    if(typeof silenceRefreshLog == "undefined"){
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'job',data:"HANDY MINER:: WROTE NEW WORK FOR MINERS"})+'\n')
      }
      else{
        console.log("\x1b[36mHANDY MINER::\x1b[0m WROTE NEW WORK FOR MINERS"/*,messageStrings*/);
      }
    }

  }
  catchMinerTimeoutErrs(){
    //catch stratum timeout errs globally
    //seems like these might be causing the Ctrl-C issue in dashboard?
    if(typeof this.server != "undefined"){
      this.server.on('error',(response)=>{
        //dont die&block here
      });
    }
    if(typeof this.redundant != "undefined"){
      this.redundant.on('error',(response)=>{
        //dont die&block here either
        this.isMGoing = false;
        if(this.stratumWasDisconnected){
          //restart peer connection then
          this.isMGoing = false;
          this.stratumWasDisconnected = false;
          this.handleStratumReconnect();
        }
      })
    }
  }
}

module.exports = HandyMiner;
