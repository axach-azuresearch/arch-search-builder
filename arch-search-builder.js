// Required libs
var config = require('./config.json');
var https = require('https');
var cronJob = require('cron').CronJob;
var nodemailer = require('nodemailer');

// Global variables
var runCount = 0;
var repeatParam = 0;

var selectedAssettype = null;
var deliverables = [ 'IsInterface', 'Domain', 'Application', 'ApprovedElement', 'SolutionBlueprint', 'Terminology', 'Event'];
var masterApplications = JSON.stringify({masterapps: [
                                {assettype:'IsInterface', id: 'APP-656', name: 'CentraSite', mail: config.centrasiteMail}, 
                                {assettype:'Domain', id: 'APP-995', name: 'Mega', mail: config.megaMail},
                                {assettype:'Application', id: 'APP-995', name: 'Mega', mail: config.megaMail},
                                {assettype:'ApprovedElement', id: 'APP-543', name: 'Innovator', mail: config.innovatorMail},
                                {assettype:'SolutionBlueprint', id: 'APP-543', name: 'Innovator', mail: config.innovatorMail},
                                {assettype:'Terminology', id: 'APP-558', name: 'Sharepoint', mail: config.sharepointMail},
                                {assettype:'Event', id: 'APP-558', name: 'Sharepoint', mail: config.sharepointMail},
                            ]}); 
var assetsToPost = null;
var arrayOldAssets = new Array();
var sliceOldAssets = null;

// Azure Storage
var azureStorage = require('azure-storage');
var azureStorageAccount = 'xxx';
var azureStorageAccessKey = 'xxx';
var azureStorageContainer = 'archsearchcontainer';
var blobService = azureStorage.createBlobService(azureStorageAccount, azureStorageAccessKey);

// Azure Search
var azureSearchHost = 'xxx';
var azureSearchPath = '/indexes/arch-search/docs';
var azureSearchApiVersion = '2016-09-01';
var azureSearchApiKey = 'xxx';
var azureSearchContentType = 'application/json; charset=utf-8';
var skipAzureAssets = 0;
var splitAzureAssets = 1000;


// Get blob from Azure Blob Storage
function getAzureStorageBlob(callback) {
    console.log("\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("***      getAzureStorageBlob starts ...      ***");
    console.log("************************************************");
    assetsToPost = null;
    blobService.getBlobToText(azureStorageContainer, selectedAssettype+".json", 
        function(err, blobContent, blob) {
            if (err) {
                console.error("Blob \'%s.json\' was not found", selectedAssettype);
                //console.error(err);
            } else {
                console.log("Blob \'%s.json\' sucessfully downloaded", selectedAssettype);
                assetsToPost = JSON.parse(blobContent);
            }
        }
    );
    setTimeout(function() { callback(); }, 2000);
}


// Read old Azure Search assets
function getAzureSearchAssetsToDelete(callback) {
    console.log("\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("*** getAzureSearchAssetsToDelete starts ...  ***");
    console.log("************************************************");
    if (assetsToPost != null) {
        repeatParam = Math.ceil(assetsToPost.value.length/splitAzureAssets);
        for (var getCount = 0; getCount <= repeatParam; getCount++) {
            var getOptions = {
                host: azureSearchHost,
                path: azureSearchPath + "?api-version=" + azureSearchApiVersion + 
                                            "&$count=true&$filter=artefactType%20eq%20\'" + selectedAssettype + "\'&$orderby=idAxa&$top=" + splitAzureAssets + "&$skip=" + (splitAzureAssets*getCount),
                method: 'GET',
                headers: {
                    'api-key': azureSearchApiKey,
                    'Content-Type': azureSearchContentType
                }
            };
            console.info("Do the Azure Search GET call");
            console.info((getCount+1) + ". get call, options:\n", getOptions);
            console.log("------------------------------------------------");
            var getReq = https.request(getOptions, function(res) {
                var resBody = [];
                res.on('data', function(chunk) {
                    resBody.push(chunk);
                });
                res.on('end', function() {
                    sliceOldAssets = JSON.parse(resBody.join('').replace(/@odata./g, ""));
                    skipAzureAssets = skipAzureAssets + splitAzureAssets;
                    if (res.statusCode < 400) {
                        if (sliceOldAssets.value.length > 0) {
                            arrayOldAssets.push(sliceOldAssets.value);
                        }
                    }
                });
            });
            getReq.end();
            getReq.on('error', function(e) {
                console.error(e);
            });
        }
    } else {
        console.log("Nothing to do.");
    }
    setTimeout(function() { callback(); }, repeatParam*1000);
}


// Delete old assets from Azure Search
function deleteAzureSearchAssets(callback) {
    console.log("\n\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("***    deleteAzureSearchAssets starts ...    ***");
    console.log("************************************************");
    if (assetsToPost != null) {
        var wholeCountToDelete = 0;
        for (var oldCount = 0; oldCount <= arrayOldAssets.length; oldCount++) {
            if (arrayOldAssets[oldCount] != null && arrayOldAssets[oldCount].length > 0) {
                var deleteRequest = "{ \"value\": [ ";
                for (var oldAssetCount = 0;  oldAssetCount < arrayOldAssets[oldCount].length; oldAssetCount++) {
                    deleteRequest = deleteRequest + "{ \"@search.action\": \"delete\", \"idAxa\": \"" + arrayOldAssets[oldCount][oldAssetCount].idAxa + "\" }, ";
                }
                deleteRequest = deleteRequest.substring(0, deleteRequest.length-2) + " ] }";
                var options = {
                    host: azureSearchHost,
                    path: azureSearchPath + '/index?api-version=' + azureSearchApiVersion,
                    method: 'POST',
                    headers: {
                        'api-key': azureSearchApiKey,
                        'Content-Type': azureSearchContentType
                    }
                };
                wholeCountToDelete = wholeCountToDelete + oldAssetCount;
                console.info("Do the " + (oldCount+1) + ". Azure Search POST call for delete");
                console.log(oldAssetCount + " " + selectedAssettype + " assets will be deleted now");
                console.info((oldCount+1) + ". delete call, options:\n", options);
                console.log("------------------------------------------------");
                var req = https.request(options, function(res) {
                    res.on('data', function(d) {
                    });
                });
                req.write(deleteRequest);
                req.end();
                req.on('error', function(e) {
                    console.error(e);
                });
            }
        }
        console.log(wholeCountToDelete + " \'" + selectedAssettype + "\' assets deleted\n");
    } else {
        console.log("Nothing to do.");
    }
    setTimeout(function() { callback(); }, repeatParam*1000);
}        
        
        
// Post new assets to Azure Search
function postAzureSearchAssets(callback) {
    console.log("\n\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("***     postAzureSearchAssets starts ...     ***");
    console.log("************************************************");
    if (assetsToPost != null) {
        var postArray = new Array(); 
        var counterPostArray = 0;
        var counterAssetsToPost = 0;
        var insertRequest = "{ \"value\": [ ";
        for (var postAsset in assetsToPost.value) {
            counterAssetsToPost++;
            insertRequest = insertRequest + JSON.stringify(assetsToPost.value[postAsset]) + ", ";
            if (counterAssetsToPost % splitAzureAssets == 0) {
                insertRequest = insertRequest.substring(0, insertRequest.length-2) + " ] }";
                postArray[counterPostArray] = insertRequest;
                counterPostArray++;
                insertRequest = "{ \"value\": [ ";
            }
        }
        insertRequest = insertRequest.substring(0, insertRequest.length-2) + " ] }";
        postArray[counterPostArray] = insertRequest;
        console.log(counterAssetsToPost + " " + selectedAssettype + " assets will be inserted now\n");
        for (var postCount = 0; postCount < postArray.length; postCount++) {
            var jsonObject = postArray[postCount];
            var options = {
                host: azureSearchHost,
                path: azureSearchPath + '/index?api-version=' + azureSearchApiVersion,
                method: 'POST',
                headers: {
                    'api-key': azureSearchApiKey,
                    'Content-Type': azureSearchContentType
                }
            };
            console.info("Do the " + (postCount+1) + ". Azure Search POST call for insert");
            console.info((postCount+1) + ". post call, options:\n", options);
            console.log("------------------------------------------------");
            var req = https.request(options, function(res) {
                res.on('data', function(d) {
                });
            });
            req.write(jsonObject);
            req.end();
            req.on('error', function(e) {
                console.error(e);
            });
        }
    } else {
        console.log("Nothing to do.");
    }
    setTimeout(function() { callback(); }, repeatParam*1000);
}
 

// Delete blob from Azure Blob Storage
function deleteAzureStorageBlob(callback) {
    console.log("\n\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("***    deleteAzureStorageBlob starts ...     ***");
    console.log("************************************************");
    if (assetsToPost != null) {
        blobService.deleteBlob(azureStorageContainer, selectedAssettype+".json", 
            function(err, response) {
                if (err) {
                    console.error("Couldn't delete blob '\%s.json\'", selectedAssettype);
                    console.error(err);
                } else {
                    console.log("Blob \'%s.json\' sucessfully deleted", selectedAssettype);
                }
            }
        );
    } else {
        console.log("Nothing to do.");
    }
    setTimeout(function() { callback(); }, 2000);
}
 

// Inform master system via mail
function sendMail(callback) {
    console.log("\n\n-= " + selectedAssettype  + " =-");
    console.log("************************************************");
    console.log("***            sendMail starts ...           ***");
    console.log("************************************************");
    if (assetsToPost != null) {
        var masterApps = JSON.parse(masterApplications);
        var maMailaddress = null;
        for (var maCount = 0;  maCount < masterApps.masterapps.length; maCount++) {
            if (selectedAssettype == masterApps.masterapps[maCount].assettype) {
                maMailaddress = masterApps.masterapps[maCount].mail;
                break;
            }
        }
        if (maMailaddress != null) {
            var transporter = nodemailer.createTransport("SMTP", {
                host: 'amg.medc.services.axa-texh.intraxa',
                port: 25,
                secure: false,
                auth: {
                    user: '',
                    pass: ''
                }
            });
            var mailOptions = {
              from: 'mail@domain',
              to: maMailaddress,
              subject: 'Architecture Search Builder: ' + selectedAssettype +  ' download completed',
              text: assetsToPost.value.length +  " " + selectedAssettype + "s are downloaded into the Architecture Search. Older " + selectedAssettype + "s are deleted."
            };
            transporter.sendMail(mailOptions, function(error, info){
              if (error) {
                console.log(error);
              } else {
                console.log('Email sent: ' + info.response);
              }
            });
        } else {
            console.log("Hmm, no mail address for " + selectedAssettype + " found");
        }
    } else {
        console.log("Nothing to do.");
    }
    setTimeout(function() { callback(); }, 2000);
}
 
 

// Batch execution
var index = -1;
deliverables.forEach( function(deliverable) {
    if (index < 0) {
        console.log("...................................................................................................................");
        console.log("                   Archtecture Search Builder starts at " + new Date());
        console.log("´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´");
    }
    index++;
    //var cronParams =  "*/100 * * * * *";
    //var cronParams =  '00 13 19 * * ' + index;
    var cronParams =  '00 ' + (index+43) + ' * * * 5';
    new cronJob(cronParams,
         function startExecution(callback) {
            selectedAssettype = deliverable;
            runCount++;
            console.log("\n\n\n...................................................................................................................");
            console.log("...................................................................................................................");
            console.log("    Archtecture Search Builder run " + runCount + " for " + selectedAssettype + " started at " + new Date());
            console.log("´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´");
            console.log("´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´");
            getAzureStorageBlob(function(error, result) {
                getAzureSearchAssetsToDelete(function(error, result) {
                    deleteAzureSearchAssets(function(error, result) {
                        postAzureSearchAssets(function(error, result) {
                            deleteAzureStorageBlob(function(error, result) {
                                //sendMail(function(error, result) {
                                //});
                            });
                        });
                    });
                });
            });
        }
    , null, true, ''); 
});
