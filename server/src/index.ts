import { MikroORM } from '@mikro-orm/core';
import { __prod__ } from './constants';
import mikroConfig from './mikro-orm.config';
import express from 'express';
import {ApolloServer} from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';

import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import { MyContext } from './types';




const main = async () => {
  const orm = await MikroORM.init(mikroConfig);
  await orm.getMigrator().up();
  
  const app = express();
  
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();
  
  app.use(
    session({
      name: 'quid',
      store: new RedisStore(
        {
          client: redisClient,
          disableTouch: true, 
          disableTTL: true
        }
          ),
      cookie: {
        maxAge: 1000 * 60*60 *365,
        httpOnly: true,
        secure: __prod__,
        sameSite: 'lax', //google it csrf
      },
      // pogledati sta je ovo
      saveUninitialized: false,
      secret: 'keyboard-cat random',
      resave: false,
    })
  )
  
  
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false, 
    }),
    context: ({req, res}) => ({ em: orm.em, req, res }) 
  });

  apolloServer.applyMiddleware({ app, cors: { origin: 'http://localhost:3000', credentials: true} })
  
  app.listen(4000, () => {
    console.log("listening on 4000");
  });

  app.get('/', (_, res) => {
    res.send('hello');
  });
}

main().catch(err => {
  console.log(err);
});