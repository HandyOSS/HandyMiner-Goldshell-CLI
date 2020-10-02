const spawn = require("child_process").spawn;
const fs = require("fs");
process.env.HANDYRAW = true;
process.env.FORCE_COLOR = true;
const inquirer = require("inquirer");

class HandyConfigurator {
  constructor() {
    this.exeName = __dirname + "/../core/cBlakeMiner_multiPlatform";
    this._gpuData;
    this._miningMode = "solo";
    this._stratumHost = "127.0.0.1";
    this._stratumPort = 3008;
    this._stratumPass = "earthlab";
    this._stratumUser;
    this._wallet;
    this._muteVictoryFanfare = false;
    this._intensity = 10;
    this._poolDifficulty = -1;
    this._canEnableHangryMode = false;
    process.on("SIGINT", function () {
      process.exit();
    });
  }
  configure() {
    return new Promise((resolve, reject) => {
      if (process.platform.indexOf("darwin") == 0) {
        //  console.log('is mac');
      } else if (process.platform.toLowerCase().indexOf("win") == 0) {
        //console.log('windows');
        this.exeName += ".exe";
      } else {
        //console.log('linux');
        this.exeName += "_Linux";
      }
      let label = " \x1b[92mWELCOME TO HANDYMINER CONFIGURATOR\x1b[0m ";
      let label2 = " \x1b[92mQUERYING ASICS...\x1b[0m ";
      let halfLen1 = Math.floor(
        (process.stdout.columns - 1 - label.length) / 2
      );
      let halfLen2 = Math.floor(
        (process.stdout.columns - 1 - label2.length) / 2
      );

      let h0_0 = "";
      let h0_1 = "";
      let h1_0 = "";
      let h1_1 = "";
      for (let i = 0; i < halfLen1; i++) {
        h0_0 += "#";
        h0_1 += "#";
      }
      label = h0_0 + label + h0_1;
      for (let i2 = 0; i2 < halfLen2; i2++) {
        h1_0 += "#";
        h1_1 += "#";
      }
      label2 = h1_0 + label2 + h1_1;

      this.rainbow();
      console.log(label);
      console.log(label2);

      /*var lines = process.stdout.getWindowSize()[1];
			//console.log('lines',lines);
			for(var i = 0; i < lines-14; i++) {
			    console.log('\r\n');
			}*/
      let allOpts = [];

      inquirer
        .prompt([
          {
            type: "list",
            name: "miningMode",
            message: "Set a Mining Mode",
            choices: ["Pool", "Solo"],
          },
          {
            name: "stratumHost",
            message: "Stratum Host: (127.0.0.1)",
          },
          {
            name: "stratumPort",
            message: "Stratum Port: (3008)",
          },
          {
            name: "stratumUser",
            message: "Stratum User: (wallet.workerName)",
          },
          {
            name: "stratumPass",
            message: "Stratum Password: (anything)",
          },

          {
            name: "fanfare",
            type: "list",
            message: "Mute Winning Block Fanfare Song!?!1!",
            choices: [
              "I would love some block fanfare, please.",
              "I dont like celebrating, mute the epic fanfare.",
            ],
          },
        ])
        .then((answers) => {
          if (answers.stratumPass != "") {
            this._stratumPass = answers.stratumPass;
          }
          if (answers.stratumHost != "") {
            this._stratumHost = answers.stratumHost;
          }
          /*if(answers.wallet != ''){
			  		this._wallet = answers.wallet;
			  	}*/
          if (answers.stratumPort != "") {
            let port;
            try {
              port = parseInt(answers.stratumPort);
            } catch (e) {
              port = answers.stratumPort;
            }
            this._stratumPort = port;
          }

          this._miningMode = answers.miningMode.toLowerCase();
          //console.log('intensity',answers.intensity);

          let now = new Date();
          if (answers.stratumUser == "") {
            this._stratumUser =
              "miner" +
              now.getTime() +
              "_" +
              Math.floor(Math.random() * 1000 + Math.random() * 1000);
          } else {
            this._stratumUser = answers.stratumUser;
          }
          if (answers.fanfare.indexOf("I would love") == 0) {
            this._muteVictoryFanfare = false;
          } else {
            this._muteVictoryFanfare = true;
          }
          let config = {
            asics: "-1",
            host: this._stratumHost,
            port: this._stratumPort,
            stratum_user: this._stratumUser,
            stratum_pass: this._stratumPass,
            mode: this._miningMode,
            poolDifficulty: this._poolDifficulty,
            muteWinningFanfare: this._muteVictoryFanfare,
          };

          this.checkPoolMode(config, resolve);

          //now prompt for pool info
          //promptPoolInfo();
        });
    });
    //console.log('psdone',psDone,allOpts.length);
  }
  checkPoolMode(config, resolve) {
    if (this._miningMode == "pool") {
      config.poolDifficulty = -1;
      this.saveConfig(config, resolve); //always -1 on pools now
    } else {
      this.saveConfig(config, resolve);
    }
  }
  saveConfig(config, resolve) {
    let configPath = __dirname + "/../goldshell.json";
    let d = new Date();
    let path =
      "goldshell_" +
      d.getDay() +
      "_" +
      d.getMonth() +
      "_" +
      d.getHours() +
      "_" +
      d.getMinutes() +
      ".json";

    let label =
      " \x1b[92mMOVING EXISTING goldshell.json TO " + path + "\x1b[0m ";
    let label2 = " \x1b[92mWROTE NEW CONFIGURATION TO goldshell.json\x1b[0m ";
    let label3 = " \x1b[92m COMMENCING MINING! \x1b[0m ";
    let halfLen1 = Math.floor((process.stdout.columns - 1 - label.length) / 2);
    let halfLen2 = Math.floor((process.stdout.columns - 1 - label2.length) / 2);
    let halfLen3 = Math.floor((process.stdout.columns - 1 - label3.length) / 2);

    let h0_0 = "";
    let h0_1 = "";
    let h1_0 = "";
    let h1_1 = "";
    let h2_0 = "";
    let h2_1 = "";

    for (let i = 0; i < halfLen1; i++) {
      h0_0 += "#";
      h0_1 += "#";
    }
    label = h0_0 + label + h0_1;
    for (let i2 = 0; i2 < halfLen2; i2++) {
      h1_0 += "#";
      h1_1 += "#";
    }
    label2 = h1_0 + label2 + h1_1;
    for (let i3 = 0; i3 < halfLen3; i3++) {
      h2_0 += "#";
      h2_1 += "#";
    }
    label3 = h2_0 + label3 + h2_1;
    let p1 = "";
    let p2 = "";
    for (let pi = 0; pi < process.stdout.columns - 1; pi++) {
      p1 += "#";
      p2 += "#";
    }
    //this.rainbow();
    console.log(p1);
    console.log(label);
    console.log(label2);
    console.log(label3);
    console.log(p2);

    fs.readFile(configPath, (err, data) => {
      if (!err) {
        //config exists, move to backup
        fs.writeFileSync(path, data.toString("utf8"));
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } else {
        //brand new
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
      this.finish(resolve);
    });
  }
  finish(resolve) {
    resolve();
  }
  rainbow() {
    console.log("                         \x1b[95m_________\x1b[0m");
    console.log(
      "                      \x1b[95m.##\x1b[0m\x1b[36m@@\x1b[0m\x1b[32m&&&&\x1b[0m\x1b[36m@@\x1b[0m\x1b[95m##.\x1b[0m"
    );
    console.log(
      "                   \x1b[95m,##\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m::\x1b[0m\x1b[38;5;9m%&&&%%\x1b[0m\x1b[33m::\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m##.\x1b[0m"
    );
    console.log(
      "                  \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[38;5;1mHANDYMINER\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    console.log(
      "                \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m00'\x1b[0m         \x1b[38;5;1m'00\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    console.log(
      "               \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0'\x1b[0m             \x1b[38;5;1m'0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    console.log(
      "              \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                 \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    console.log(
      "             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    console.log(
      "             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m"
    );
    //console.log('             \x1b[95m"\x1b[0m" \x1b[33m\'\x1b[0m "                   " \' "\x1b[95m"\x1b[0m')
    console.log(
      "           \x1b[33m_oOoOoOo_\x1b[0m                    \x1b[92mTHE\x1b[0m "
    );
    console.log(
      "          (\x1b[33moOoOoOoOo\x1b[0m)                \x1b[92mHANDSHAKE\x1b[0m"
    );
    console.log(
      '           )`"""""`(                 \x1b[92mCOMMUNITY\x1b[0m'
    );
    console.log("          /          \\              ");
    console.log("         |    \x1b[92mHNS\x1b[0m     |              ");
    console.log("         \\           /              ");
    console.log("          `=========`");
    console.log("");
    console.log("");
  }
}
module.exports = HandyConfigurator;
