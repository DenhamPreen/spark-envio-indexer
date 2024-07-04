import { OrderBookContract } from "generated";
import { orderStatus, OrderType, AssetType } from "generated/src/Enums.gen";
import { nanoid } from "nanoid";
import crypto from 'crypto';

function updateLatestOrders(context: any, orderId: string) {
  let latestOrders = context.LatestOrders.get('latest');
  if (!latestOrders) {
    latestOrders = { id: 'latest', order_ids: [] };
  }

  latestOrders.order_ids.push(orderId);
  latestOrders.order_ids = latestOrders.order_ids.slice(-100);

  context.LatestOrders.set(latestOrders);
}

OrderBookContract.OpenOrderEvent.loader(async ({ event, context }) => {
  context.Order.load(event.data.order_id);
  context.LatestOrders.load('latest');
});

OrderBookContract.OpenOrderEvent.handler(async ({ event, context }) => {
  const openOrderEvent = {
    id: nanoid(),
    order_id: event.data.order_id,
    tx_id: event.transactionId,
    asset: event.data.asset.bits,
    amount: event.data.amount,
    asset_type: event.data.asset_type.case as AssetType,
    order_type: event.data.order_type.case as OrderType,
    price: event.data.price,
    user: event.data.user.payload.bits,
    timestamp: new Date(event.time * 1000).toISOString(),
  };
  context.OpenOrderEvent.set(openOrderEvent);

  const order = {
    ...openOrderEvent,
    id: event.data.order_id,
    initial_amount: event.data.amount,
    status: "Active" as orderStatus,
  };
  context.Order.set(order);

  updateLatestOrders(context, order.id);
});

OrderBookContract.CancelOrderEvent.loader(async ({ event, context }) => {
  context.Order.load(event.data.order_id);
  context.LatestOrders.load('latest');
});

OrderBookContract.CancelOrderEvent.handler(async ({ event, context }) => {
  const cancelOrderEvent = {
    id: nanoid(),
    order_id: event.data.order_id,
    tx_id: event.transactionId,
    timestamp: new Date(event.time * 1000).toISOString(),
  };

  context.CancelOrderEvent.set(cancelOrderEvent);

  const order = context.Order.get(event.data.order_id);
  if (order) {
    context.Order.set({
      ...order,
      amount: 0n,
      status: "Canceled",
      timestamp: new Date(event.time * 1000).toISOString(),
    });
  } else {
    context.log.error(`Cannot find an order ${event.data.order_id}`);
  }
});

OrderBookContract.MatchOrderEvent.loader(async ({ event, context }) => {
  context.Order.load(event.data.order_id);
  context.LatestOrders.load('latest');
});

OrderBookContract.MatchOrderEvent.handler(async ({ event, context }) => {
  const matchOrderEvent = {
    id: nanoid(),
    order_id: event.data.order_id,
    tx_id: event.transactionId,
    asset: event.data.asset.bits,
    order_matcher: event.data.order_matcher.payload.bits,
    owner: event.data.owner.payload.bits,
    counterparty: event.data.counterparty.payload.bits,
    match_size: event.data.match_size,
    match_price: event.data.match_price,
    timestamp: new Date(event.time * 1000).toISOString(),
  };
  context.MatchOrderEvent.set(matchOrderEvent);

  const order = context.Order.get(event.data.order_id);
  if (order) {
    const amount = order.amount - event.data.match_size;
    context.Order.set({
      ...order,
      amount,
      status: amount === 0n ? "Closed" : "Active",
      timestamp: new Date(event.time * 1000).toISOString(),
    });
    updateLatestOrders(context, order.id);
  } else {
    context.log.error(`Cannot find an order ${event.data.order_id}`);
  }
});

OrderBookContract.TradeOrderEvent.loader(async ({ event, context }) => {
  context.LatestOrders.load('latest');
});

OrderBookContract.TradeOrderEvent.handler(async ({ event, context }) => {
  const idSource = `${event.data.order_matcher}-${event.data.trade_size}-${event.data.trade_price}-${event.data.base_sell_order_id}-${event.data.base_buy_order_id}-${event.data.tx_id}`;
  const id = crypto.createHash('sha256').update(idSource).digest('hex');
  const tradeOrderEvent = {
    id,
    base_sell_order_id: event.data.base_sell_order_id,
    base_buy_order_id: event.data.base_buy_order_id,
    tx_id: event.transactionId,
    order_matcher: event.data.order_matcher.payload.bits,
    trade_size: event.data.trade_size,
    trade_price: event.data.trade_price,
    timestamp: new Date(event.time * 1000).toISOString(),
  };

  context.TradeOrderEvent.set(tradeOrderEvent);
});

OrderBookContract.DepositEvent.loader(async ({ event, context }) => {
  const idSource = `${event.data.asset.bits}-${event.data.user.payload.bits}`;
  const id = crypto.createHash('sha256').update(idSource).digest('hex');
  context.Balance.load(id);
  context.LatestOrders.load('latest');
});

OrderBookContract.DepositEvent.handler(async ({ event, context }) => {
  const depositEvent = {
    id: nanoid(),
    tx_id: event.transactionId,
    amount: event.data.amount,
    asset: event.data.asset.bits,
    user: event.data.user.payload.bits,
    timestamp: new Date(event.time * 1000).toISOString(),
  };
  context.DepositEvent.set(depositEvent);

  const idSource = `${event.data.asset.bits}-${event.data.user.payload.bits}`;
  const id = crypto.createHash('sha256').update(idSource).digest('hex');
  let balance = context.Balance.get(id);
  if (balance) {
    const amount = balance.amount + event.data.amount;
    context.Balance.set({ ...balance, amount });
  } else {
    context.Balance.set({ ...depositEvent, id });
  }
});

OrderBookContract.WithdrawEvent.loader(async ({ event, context }) => {
  const idSource = `${event.data.asset.bits}-${event.data.user.payload.bits}`;
  const id = crypto.createHash('sha256').update(idSource).digest('hex');
  context.Balance.load(id);
  context.LatestOrders.load('latest');
});

OrderBookContract.WithdrawEvent.handler(async ({ event, context }) => {
  const withdrawEvent = {
    id: nanoid(),
    tx_id: event.transactionId,
    amount: event.data.amount,
    asset: event.data.asset.bits,
    user: event.data.user.payload.bits,
    timestamp: new Date(event.time * 1000).toISOString(),
  };
  context.WithdrawEvent.set(withdrawEvent);

  const idSource = `${event.data.asset.bits}-${event.data.user.payload.bits}`;
  const id = crypto.createHash('sha256').update(idSource).digest('hex');
  let balance = context.Balance.get(id);
  if (balance) {
    const amount = balance.amount - event.data.amount;
    context.Balance.set({ ...balance, amount });
  } else {
    context.log.error(`Cannot find a balance; user:${event.data.user}; asset: ${event.data.asset.bits}; id: ${id}`);
  }
});

// function tai64ToDate(tai64: bigint): string {
//   const dateStr = (
//     (tai64 - BigInt(2) ** BigInt(62) - BigInt(10)) * BigInt(1000)
//   ).toString();
//   return new Date(+dateStr).toISOString();
// }

// function decodeI64(i64: { readonly value: bigint; readonly negative: boolean }): string {
//   return (i64.negative ? "-" : "") + i64.value.toString();
// }