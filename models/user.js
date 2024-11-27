import mongoose from 'mongoose';
import validator from 'validator';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Le nom d\'utilisateur est requis'],
    unique: true,
    trim: true,
    minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
    maxlength: [30, 'Le nom d\'utilisateur ne doit pas dépasser 30 caractères'],
    validate: {
      validator: (v) => /^[a-zA-Z0-9_]+$/.test(v),
      message: 'Le nom d\'utilisateur ne doit contenir que des lettres, des chiffres et des underscores'
    }
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: 'L\'email n\'est pas valide'
    }
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    validate: {
      validator: (v) => {
        return (
          /[a-z]/.test(v) && // au moins une lettre minuscule
          /[A-Z]/.test(v) && // au moins une lettre majuscule
          /[0-9]/.test(v) && // au moins un chiffre
          /[\W_]/.test(v)    // au moins un caractère spécial
        );
      },
      message: 'Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial'
    }
  },
  role: {
    type: String,
    required: true,
    enum: ['user', 'manager', 'admin'],
    default: 'user'
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cocktail',
    index: true
  }]
});

export default mongoose.model('User', userSchema);