const express = require('express');
const fs = require('fs');
const path = require('path');
const { PORT, imageFolder, dbFolder } = require('./config');
const Datastore = require('nedb');
const db = new Datastore({ filename : `${dbFolder}/images`, autoload: true });
const multer = require('multer');
const { generateId } = require('./utils/generateId');
const sizeOf = require('image-size');
const { replaceBackground } = require('backrem');

const app = express();

app.use(express.json());
app.use(express.static('imageFolder'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imageFolder)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  }
  else{
    cb(null, false);
  }
};

app.use(multer({ storage: storage, fileFilter: fileFilter }).single('image'));

app.post('/upload', async (req, res) => {
  try {
    const filedata = req.file;

    if(!filedata) {
      return res.sendStatus(400);
    } else {
      const id = generateId();
      const { originalname, size } = filedata;
      const createdAt = Date.now();
      const file = { id, originalname, size, createdAt };

      db.insert(file, function (err, newImages) {
        if (err) {
          return res.status(500).send(err);
        } else {
          return res.json({ id });
        }
      });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/list', async (req, res) => {
  try {
    db.find({}, function (err, allImages) {
      if (err) {
        return res.status(500).send(err);
      } else {
        const formattedAllImages = allImages.reduce((allImages, image) => {
          const { id, size, createdAt, originalname } = image;
          allImages.push({ id, size, createdAt, originalname });

          return allImages;
        }, []);

        return res.json(formattedAllImages);
      }
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/image/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    db.findOne({ id: imageId }, function (err, image) {
      if (err) {
        return res.status(500).send(err);
      } else {
        if (image === null) {
          return res.sendStatus(400);
        } else {
          const fileName = image?.originalname;
          return res.download(`${imageFolder}/${fileName}`);
        }
      }
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete('/image/:id', async (req, res) => {
  try {
    const imageId = req.params.id;

    db.remove({ id: imageId }, {}, function (err, numRemoved) {
      if (err) {
        return res.status(500).send(err);
      }

      return res.json({ id: imageId });
    });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/merge', async (req, res) => {
  try {
    const { front, back, color, threshold } = req.query;

    const currentColors = color.split(',').map(Number);
    const currentThreshold = Number(threshold) || 0;

    function getImage (currentId) {
      return new Promise((resolve, reject) => {
        db.findOne({ id: currentId }, (err, image) => {
          if (err) {
            return reject(err);
          }

          if (image === null) {
            return res.sendStatus(400);
          } else {
            return resolve(image);
          }
        });
      });
    }

    const frontImageFile = await getImage(front);
    const backImageFile = await getImage(back);

    const pathToFrontImageFileFile = path.resolve(imageFolder, frontImageFile?.originalname);
    const pathToBackImageFileFile = path.resolve(imageFolder, backImageFile?.originalname);

    const sizeFrontImage = sizeOf(pathToFrontImageFileFile);
    const sizeBackImage = sizeOf(pathToBackImageFileFile);

    if (sizeFrontImage.width !== sizeBackImage.width && sizeFrontImage.height !== sizeBackImage.height) {
      return res.sendStatus(400);
    }

    const frontImage = fs.createReadStream(pathToFrontImageFileFile);
    const backImage = fs.createReadStream(pathToBackImageFileFile);

    replaceBackground(frontImage, backImage, currentColors, currentThreshold)
      .then((readableStream) => {
        res.setHeader('Content-Type', 'image/jpeg');
        readableStream.pipe(res);
      });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
