import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import {
  isAuth,
  isAdmin,
  isSeller,
  mailgun,
  payOrderEmailTemplate,
} from '../utils.js';

const orderRouterSeller = express.Router();

orderRouterSeller.get(
  '/',
  isAuth,
  isSeller,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.query.userId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.send(orders);
  })
);

orderRouterSeller.post(
  '/',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const newOrder = new Order({
      orderItems: req.body.orderItems.map((x) => ({ ...x, product: x._id })),
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod,
      itemsPrice: req.body.itemsPrice,
      shippingPrice: req.body.shippingPrice,
      taxPrice: req.body.taxPrice,
      totalPrice: req.body.totalPrice,
      user: req.user._id,
    });

    const order = await newOrder.save();
    res.status(201).send({ message: 'New Order Created', order });
  })
);

orderRouterSeller.get(
  '/summary',
  isAuth,
  isSeller,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.aggregate([
      {
        $group: {
          _id: null,
          numOrders: { $sum: 1 },
          totalSales: { $sum: '$totalPrice' },
        },
      },
    ]);
    const users = await User.aggregate([
      {
        $group: {
          _id: null,
          numUsers: { $sum: 1 },
        },
      },
    ]);
    const dailyOrders = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          sales: { $sum: '$totalPrice' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const productCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);
    res.send({ users, orders, dailyOrders, productCategories });
  })
);

orderRouterSeller.get(
  '/mine',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.send(orders);
  })
);

orderRouterSeller.get(
  '/:id',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      res.send(order);
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

orderRouterSeller.put(
  '/:id/deliver',
  isAuth,
  isSeller,
  expressAsyncHandler(async (req, res) => {
    // const order = await Order.findById(req.params.id);
    const order = await Order.findById(req.params.id).populate(
      'user',
      'email name'
    );
    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      await order.save();

      const fg = mailgun({
        apiKey: 'd60b08f2dc70752e98b926b858db5a80-07ec2ba2-66f28d61',
        domain: 'sandbox01fe5fe6a91246ef9ae3a368e2e0e10d.mailgun.org',
      });

      // Define your email data
      const data = {
        from: 'IUTCart <iutcart@gmail.com>',
        to: `${order.user.name} <${order.user.email}>`,
        subject: `New order ${order._id}`,
        html: payOrderEmailTemplate(order),
      };

      // Send the email
      fg.messages().send(data, function (error, body) {
        if (error) {
          console.log(error);
          res.status(500).send({ message: 'Error sending email' });
        } else {
          console.log(body);
          res.send({ message: 'Order Delivered' });
        }
      });
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

export default orderRouterSeller;
