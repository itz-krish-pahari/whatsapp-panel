const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }
    next();
  };
}

const schemas = {
  sendText: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    quotedMessageId: Joi.string().optional()
  }),

  sendImage: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    caption: Joi.string().optional().allow(''),
    url: Joi.string().uri().optional()
  }),

  sendDocument: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    filename: Joi.string().optional(),
    caption: Joi.string().optional().allow(''),
    url: Joi.string().uri().optional()
  }),

  sendButtons: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    body: Joi.string().required(),
    title: Joi.string().optional().allow(''),
    footer: Joi.string().optional().allow(''),
    buttons: Joi.array().items(
      Joi.object({ id: Joi.string(), text: Joi.string().required() })
    ).min(1).max(3).required()
  }),

  sendList: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    title: Joi.string().required(),
    body: Joi.string().required(),
    buttonText: Joi.string().required(),
    footer: Joi.string().optional().allow(''),
    sections: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        rows: Joi.array().items(
          Joi.object({ id: Joi.string(), title: Joi.string().required(), description: Joi.string().optional() })
        ).required()
      })
    ).required()
  }),

  sendLocation: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    name: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow('')
  }),

  sendPoll: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    question: Joi.string().required(),
    options: Joi.array().items(Joi.string()).min(2).max(12).required(),
    allowMultipleAnswers: Joi.boolean().optional()
  }),

  sendBulk: Joi.object({
    sessionId: Joi.string().required(),
    recipients: Joi.array().items(Joi.string()).min(1).required(),
    messageConfig: Joi.object({
      type: Joi.string().valid('text', 'image', 'document').required(),
      text: Joi.string().optional(),
      filePath: Joi.string().optional(),
      caption: Joi.string().optional().allow(''),
      filename: Joi.string().optional()
    }).required(),
    delayMs: Joi.number().optional()
  }),

  checkNumber: Joi.object({
    sessionId: Joi.string().required(),
    number: Joi.string().required()
  }),

  createSession: Joi.object({
    sessionId: Joi.string().alphanum().min(3).max(50).required(),
    label: Joi.string().optional().allow('')
  }),

  sendLink: Joi.object({
    sessionId: Joi.string().required(),
    to: Joi.string().required(),
    url: Joi.string().uri().required(),
    text: Joi.string().optional().allow('')
  })
};

module.exports = { validate, schemas };
