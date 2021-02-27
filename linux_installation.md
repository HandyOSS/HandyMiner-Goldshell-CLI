### Linux Installation

Install node.js 14.x and deps
```
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install alsa-utils
```

If Make is not installed, you will not be able to run the npm install command, so run this first
```
sudo apt-get install build-essentials
```

Now that node.js is installed, install the module dependencies for HandyMiner in the HandyMiner-Goldshell-GUI directory
```
npm install
```

Mine HNS.

#### HiveOS Users possible gotchas during installation:

During dependency installation, hiveOS users may run into errors about ```EACCES permissions for mkdir```. To resolve, run the install command like: ```sudo npm install --unsafe-perm=true --allow-root```
