### Linux Installation

Install node.js 10.x and deps
```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install node-gyp
sudo apt install alsa-utils
```

#### HiveOS Users possible gotchas during installation:

During dependency installation, hiveOS users may run into errors about ```EACCES permissions for mkdir```. To resolve, run the install command like: ```sudo npm install --unsafe-perm=true --allow-root```


#### RaspbianOS
During the installation it might result on not installing node-gyp.
In order to fix that install `aptitude`. `Aptitude` analizes the issues at installation and proposes solutions to it.
```
sudo apt-get install aptitude
sudo aptitude install node-gyp
```

