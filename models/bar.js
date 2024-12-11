import mongoose from 'mongoose';
import validator from 'validator';

function validateGeoJsonCoordinates(value) {
  return Array.isArray(value) && value.length >= 2 && value.length <= 3 && isLongitude(value[0]) && isLatitude(value[1]);
}

function isLatitude(value) {
  return value >= -90 && value <= 90;
}

function isLongitude(value) {
  return value >= -180 && value <= 180;
}

const barSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    minlength: [3, 'Le nom doit contenir au moins 3 caractères'],
    maxlength: [100, 'Le nom ne doit pas dépasser 100 caractères']
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    minlength: [10, 'La description doit contenir au moins 10 caractères'],
    maxlength: [1000, 'La description ne doit pas dépasser 1000 caractères']
  },
  image_url: {
    type: String,
    required: [true, 'L\'URL de l\'image est requise'],
    trim: true,
    validate: [validator.isURL, 'Veuillez fournir une URL valide']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: [validateGeoJsonCoordinates, 'Veuillez fournir des coordonnées GeoJSON valides']
    }
  }
});

barSchema.index({
  location: '2dsphere'
});

const Bar = mongoose.model('Bar', barSchema);

export default Bar;