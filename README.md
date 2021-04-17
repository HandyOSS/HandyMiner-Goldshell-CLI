<img src="https://raw.githubusercontent.com/HandyMiner/HandyGuide/72303a89968942dc945e05588db5db2a6610c539/logo/cobra.svg" width="150" height="150" />

**HandyMiner-Goldshell-CLI**

**Now Supporting the Goldshell HS1-Plus!**

### [HandyMiner-Goldshell-CLI Quick Start Guide](https://handyminer.github.io/HandyMiner-Goldshell-CLI/index.html)

**HandyMiner Team Donation Address (HNS): ```hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8```**

**HandyMiner Team Donation Address (BTC): ```bc1qk3rk4kgek0hzpgs8qj4yej9j5fs7kcnjk7kuvt```**

**Quick Links**
- [Download Latest from Releases](https://github.com/HandyMiner/HandyMiner-Goldshell-CLI/releases)

- [Prerequisites and Installation](#buildInstructions)

- [Fullnode Solo-Mining Setup](#runFullnode)

- [Pool Settings](#poolParameters)

- [FAQ](#faq)

**HandyMiner Social Channels:**

[HandshakeTalk Telegram](https://t.me/handshaketalk)


Description: A simple CLI interface (+optional Dashboard) for HSD Mining to enable the Goldshell HS1
to communicate with Handshake HSD via Stratum Mining. 
# Easy Installation
       Easily installed within minutes.
       Simple ASIC Configuration setup.
       Note: Make sure your device is set to not sleep automatically, otherwise your miner will stop mining.

### HandyMiner Running with Dashboard Enabled

![Imgur](https://i.imgur.com/qwbNden.jpg)

<a id="buildInstructions"></a>
## PREREQUISITES

[Node.js](https://nodejs.org) v10.4 and above (whatever one has bigint support)

(**Windows Users**) [Git Bash](https://git-scm.com/downloads) A handy bash terminal, **install in Program Files/Git**

(**Windows Users**) [Download STM32 Virtual COM PORT driver](https://github.com/HandyMiner/HandyMiner-Goldshell-CLI/raw/master/windows_utils/STSW_STM32102_V1.5.0.zip) OR [Download STM32 Virtual COM PORT driver from STMicroelectronics](https://www.st.com/en/development-tools/stsw-stm32102.html)

Linux: Dependencies install can be found in [./linux_installation.md](./linux_installation.md)

Raspberry Pi Installation Steps [./raspberry_pi_installation.md](./raspberry_pi_installation.md)


## INSTALLATION

#### > Clone this repo or Download & Install as ZIP :

[Download Latest from Releases](https://github.com/HandyMiner/HandyMiner-Goldshell-CLI/releases)

**Note: un-zipping the full contents may take a bit.**

#### > Install Dependencies (mac/linux/windows) :

```npm install``` in this directory or 

#### > Windows Double-click install dependencies : 

Double-click ```install.windows.bat```.

Windows folks: If you didnt double click ```install.windows.bat``` youll need to run the following command in the repo root: 

```npm install```

<a id="running"></a>
## THE POINT

First, make sure to plug AC power into the Goldshell HS1 and connect the USB from the HS1 to your computer. 

Non-terminal users: simply double click ```(windows) dashboard.windows.bat``` or ```(mac) dashboard.mac.command``` or ```(linux) dashboard.sh``` files.

**Note:** The first time you launch will run you thru the [miner configurator](#minerConfigurator).

Launch the miner in terminal **in a bash terminal (windows: git-bash)** like:
```
cd (into the repo base)
npm start (runs the CLI miner)

Most terminals:
npm run dashboard //runs the CLI dashboard+miner
OR
./dashboard.sh //same

Note: many windows terminals dont do text coloring or dashboards right with npm run commands.. So if it's an issue (and you didnt double click) you can launch the proper dashboard like:

node ./miner/dashboard.js
```
#### Ubuntu Users note:

To have this app talk to the goldshell serial devices out of the box, you may have to run with ```sudo``` (we did in ubuntu, but not raspi). If you run ```node mine.js``` and run into errors: To grant permissions to your user to talk to the devices without sudo, perform the steps in the [Ubuntu FAQ](#linuxFAQ)

#### Mine blocks!

(Ctrl+C, Q, or ESC to stop the dashboard miner)

<a id="minerConfigurator"></a>
## MINER CONFIGURATOR

The first time you run the miner, you will run through a configurator which will write a config to ./goldshell.json. Should you want to reconfigure in the future, you can just run ```node configure.js``` in this directory. Alternately delete goldshell.json and (re)start the miner.

Required items to have ready for configuration:

0. Host or IP address of the pool or solo node you mine to (127.0.0.1 for your local fullnode)
1. (Pool mining) Your wallet address or registered pool username

Optional configuration items (just leave blank and hit enter if you dont know) :

2. Pool or solo node port (probably 3008)
3. The stratum password (optional)

<a id="poolParameters"></a>
## POOL SETTINGS

#### DXPOOL

**stratum host**: hns.ss.dxpool.com
**stratum port**: 3008

**username**: registered_username.workerName
**password**: anything

#### F2POOL

**stratum host**: hns.f2pool.com
**stratum_port**: 6000

non-registered: 
**username**: walletAddress.workerName
**password**: anything

registered:
**username**: username.workerName
**password**: anything

#### hnspool

**stratum host**: stratum-us.hnspool.com
**stratum_port**: 3001

non-registered: 
**username**: walletAddress.workerName
**password**: anything

registered: 
**username**: hnspool_registered_username.workerName
**password**: anything

<a id="advancedOptions"></a>
## Advanced Options:

**App/API developers**: You can run like ```HANDYRAW=true node mine.js``` or set the environment variable ```HANDYRAW=true``` and the miner executable will output raw JSON. The dashboard application is built using the raw CLI JSON output.

**Multiple Configs!**: If you want to use different worker names or pools with the same miner executable, you can pass in your custom config.json into the miner like:
```node mine.js myCustomConfigName.json```
Note the miner will default to config.json without this argument.

**ASIC per Config**: If you are using multiple configs, you may want to group multiple Goldshell HS1's as you see fit. Within ```goldshell.json``` the line ```asics:"-1"``` can change to: ```asics:"COM1,COM2"```. basically the COM* values are the ports displayed initially when you start the miner with ```node mine.js```


<a id="faq"></a>
## Mining FAQ:

1. I started the dashboard and it says connection to 127.0.0.1 is timed out and trying again in 20s. 

This means your fullnode is not running. Please [launch a fullnode](#runFullnode)  or mine to a pool IP address.

2. No ASICs were detected.

Ensure the blue LED next to the USB port on the HS1 is solid blue. If so, and you're in Windows, [Download STM32 Virtual COM PORT driver from Goldshell](https://github.com/goldshellminer/HS1/tree/master/miner/serial_driver) so that the ASIC can be detected

3. Solo miners: We do not auto-start the fullnode for you here like we do in HandyMiner-GUI. However we made it easy here. If you want to run your own fullnode to mine to with the provided utilities: [docker fullnode instructions](./fullnode_utils/fullnode_instructions.md)

4. Windows may also need to add the following two items added to the ```Path``` environment variable:

```
C:\Program Files\nodejs\node_modules\npm\bin
```
<a id="linuxFAQ"></a>

#### Ubuntu FAQ

If you try to mine out of the box without ```sudo``` you may see an error that looks like:
```
asic connection error:: [Error: Error: Permission denied, cannot open /dev/ttyACM0]
```

If you dont want to run as sudo, you can modify your permissions to the ASIC device like so:

Notice the serial address in the error ^^ : ```/dev/ttyACM0```
On the terminal, we will need to add your user to the group that owns the serial device, then restart the Linux machine.

##### To add your user to the device group for access: 
##### the easy way: ```sudo ./linux_grant_serial_permissions.sh```, and then restart the linux machine.
##### or the less easier way: 
0. Run the command with the device ID listed in the error, like:
```ls -la /dev/ttyACM0```
It will output something like:
```crw-rw---- 1 root dialout 166, 0 Jul 18 18:06 /dev/ttyACM0```
Which in our case, the group is ```dialout```
1. To add your username to the dialout group:
```sudo useradd -G dialout $USER``` (OR ON SOME SYSTEMS) ```sudo adduser $USER dialout```
2. Now restart the computer and voila, you can now mine without sudo!


```
       _.-._        _.-._
     _| | | |      | | | |_
    | | | | |      | | | | |
    | | | | |      | | | | |
    | _.-'  | _  _ |  '-._ |
    ;_.-'.-'/`/  \`\`-.'-._;
    |   '    /    \    '   |
     \  '.  /      \  .`  /
      |    |        |    |

```

EPIC Thanks to chjj and the entire Handshake Project

EPIC Thanks to Steven McKie for being my mentor/believing in me

EPIC Thanks to the Goldshell team for making innovative hardware


Copyright 2020 HandyMiner

Copyright 2020 Alex Smith - alex.smith@earthlab.tech

Copyright 2020 Steven McKie - mckie@amentum.org 

Copyright 2020 Thomas Costanzo - stanzo89@gmail.com

[LICENSE](./LICENSE)
