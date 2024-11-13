import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: true,
    minlength: 6,
    validate: {
      validator: (v) => v.length >= 6,
      message: 'Le mot de passe doit contenir au moins 6 caractères'
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
    ref: 'Coktail',
    index: true
  }]
});

export default mongoose.model('User', userSchema);
