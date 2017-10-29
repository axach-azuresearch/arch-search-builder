### _start application_

```
> node arch-search-builder.js
```

### _cron job parameters_

#### _Run a job for every 10 second_
```
'*/10 * * * * *'
```

#### _Run a job on 4:00 PM every day_
```
'00 00 16 * * *'
```

#### _Run a job on 11th day of every month at specific time_
```
'00 03 16 11 * *'
```


##### _Docs about reading blobs from Azure strorage_
```
[willi.am blog](http://willi.am/blog/2014/07/03/azure-blob-storage-and-node-downloading-blobs)
```

##### _Docs about cron jobs with cron_
```
[npmjs cron](https://www.npmjs.com/package/node-cron)
```
