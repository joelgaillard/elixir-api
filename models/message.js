import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  barId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bar',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model('Message', messageSchema);

export default Message;