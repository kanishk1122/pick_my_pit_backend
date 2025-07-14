import Joi from "joi";

const signup_auth: Joi.ObjectSchema = Joi.object({
  firstname: Joi.string().min(3).max(30).required(),
  lastname: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid("user").required(),
  password: Joi.string().min(6).max(20).required(),
  gender: Joi.string().valid("male", "female", "custom").required(),
});

const login_auth: Joi.ObjectSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().max(20).required(),
});

const post_validation: Joi.ObjectSchema = Joi.object({
  title: Joi.string().required().min(3).max(100),
  discription: Joi.string().required().min(20),
  amount: Joi.number().min(0).default(0),
  type: Joi.string().valid("free", "paid").default("free"),
  category: Joi.string().required(),
  species: Joi.string().required(),
  userId: Joi.string().required(),
  addressId: Joi.string().required(),
  images: Joi.array().items(Joi.string()).required(),
  age: Joi.object({
    value: Joi.number().min(0).required(),
    unit: Joi.string().valid("days", "weeks", "months", "years").required(),
  }).optional(),
});

const post_update_validation: Joi.ObjectSchema = Joi.object({
  title: Joi.string().required(),
  discription: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  type: Joi.string().valid("free", "paid").default("free"),
  category: Joi.string().required(),
species: Joi.string().required(),  
userId: Joi.string().required() 
});

export {
   signup_auth,
   post_validation,
   login_auth,
   post_update_validation,
};