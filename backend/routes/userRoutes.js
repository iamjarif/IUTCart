import express from 'express';
import bcrypt from 'bcryptjs';
import expressAsyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { generateToken, baseUrl } from '../utils.js';
import mailgun from 'mailgun-js';

const userRouter = express.Router();

userRouter.post(
  '/signin',
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          token: generateToken(user),
        });
        return;
      }
    }
    res.status(401).send({ message: 'Invalid email or password' });
  })
);

userRouter.post(
  '/signup',
  expressAsyncHandler(async (req, res) => {
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password),
    });
    const user = await newUser.save();
    res.send({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user),
    });
  })
);

userRouter.post(
  '/forget-password',
  expressAsyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '3h',
      });
      user.resetToken = token;
      await user.save();

      console.log(`${baseUrl()}/reset-password/${token}`);

      // import mailgun from 'mailgun-js';

      // Create a new Mailgun instance with your API key and domain
      const fg = mailgun({
        apiKey: '9f7364332aa0b6773e6e9bf61f194824-b36d2969-66ef61df',
        domain: 'sandboxdd0bfead77e84afab2c8385de20794bd.mailgun.org',
      });
      // console.log(`mail gese`);
      // Define your email data
      const data = {
        from: 'IUTCart <iutcart@gmail.com>',
        to: `${user.name} <${user.email}>`,
        subject: 'Reset Password',
        text: `Click this link to reset your password: ${baseUrl()}/reset-password/${token}`,
        html: `<p>Click this link to reset your password: <a href="${baseUrl()}/reset-password/${token}">${baseUrl()}/reset-password/${token}</a></p>`,
      };
      console.log(`mail gese`);
      // Send the email
      fg.messages().send(data, function (error, body) {
        if (error) {
          console.log(error);
        } else {
          console.log(body);
        }
      });
      console.log(`mail gese`);
      //reset link
      console.log(`${baseUrl()}/reset-password/${token}`);

      // mailgun()
      //   .messages()
      //   .send(
      //     {
      //       form: 'IUTCart <iutcart@gmail.com>',
      //       to: `${user.name} <${user.email}>`,
      //       subject: `Reset Password`,
      //       html: `
      //     <p>Follow the link to reset your password:</p>
      //     <a href="${baseUrl()}/reset-password/${token}"}>Reset Password</a>
      //     `,
      //     },

      //     (error, body) => {
      //       console.log(error);
      //       console.log(body);
      //     }
      //   );

      res.send({ message: 'We sent a reset password link to your mail.' });
    } else {
      res.status(404).send({ message: 'User not found.' });
    }
  })
);

userRouter.post(
  '/reset-password',
  expressAsyncHandler(async (req, res) => {
    jwt.verify(req.body.token, process.env.JWT_SECRET, async (err, decode) => {
      if (err) {
        res.status(401).send({ message: 'Invalid Token' });
      } else {
        const user = await User.findOne({ resetToken: req.body.token });
        if (user) {
          if (req.body.password) {
            user.password = bcrypt.hashSync(req.body.password, 8);
            await user.save();
            res.send({
              message: 'Password reseted successfully',
            });
          }
        } else {
          res.status(404).send({ message: 'User not found' });
        }
      }
    });
  })
);

export default userRouter;
