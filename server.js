require('dotenv').config();

const express = require('express');
const path = require('path');
const mongodb = require('mongodb').MongoClient;
const GoogleImages = require('google-images');
const client = new GoogleImages(process.env.CSE_ID, process.env.API_KEY);

const app = express();
var db = null;

app.enable('trust proxy');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get('/', (req, res) => {
    res.render('index', {
        title: 'Image Search Abstraction Layer',
        url: `${req.protocol}://${req.headers.host}`
    });
});

app.get('/api/latest/imagesearch/', (req, res) => {
    var offset = 0;
    if (req.query.offset && req.query.offset.match(/^\d+$/)) {
        offset = Number(req.query.offset);
    }

    db.collection('search_history').find({}, {
        _id: 0
    }).sort({
        createdAt: 1
    }).limit(10).skip(offset).toArray((err, docs) => {
        if (err) throw err;
        res.json(docs);
    });
});

app.get('/api/imagesearch/:search_term', (req, res) => {
    var offset = 0;
    if (req.query.offset && req.query.offset.match(/^\d+$/)) {
        offset += Number(req.query.offset);
    }
    offset = Math.floor((offset + 10) / 10);

    db.collection('search_history').insert({
        term: req.params.search_term,
        when: new Date()
    });

    db.collection('search_results').find({
        search_term: req.params.search_term,
        page: offset
    }).toArray((err, docs) => {
        if (err) throw err;
        if (docs.length) {
            console.log('sending cached');
            res.json(docs[0].data);
        }
        else {
            console.log('sending fresh');
            client.search(req.params.search_term, {
                page: offset
            }).then((images) => {
                var results = [];
                for (var i = 0; i < images.length; i++) {
                    results.push({
                        url: images[i].url,
                        snippet: images[i].description,
                        thumbnail: images[i].thumbnail.url,
                        context: images[i].parentPage,
                    });
                }

                res.json(results);
                db.collection('search_results').insert({
                    search_term: req.params.search_term,
                    page: offset,
                    createdAt: new Date(),
                    data: results
                }, (err) => {
                    if (err) throw err;
                });
            }).catch((err) => {
                console.error(err);
                res.status(500).json({
                    'error': err
                });
            });
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

mongodb.connect(process.env.MONGO_URL, (err, database) => {
    if (err) throw err;

    db = database;
    db.collection('search_results').createIndex({
        createdAt: 1
    }, {
        expireAfterSeconds: 86400
    });

    db.collection('search_history').createIndex({
        when: 1
    }, {
        expireAfterSeconds: 86400
    });

    var listener = app.listen(process.env.PORT || 3000, () => {
        console.log(`Server listening on ${listener.address().port}`);
    });
});
