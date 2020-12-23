import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from "type-graphql";

import * as argon2 from 'argon2';



@InputType()
class UsernamePasswordInput {
  @Field()
  username: string
  @Field()
  password: string
}

@ObjectType() 
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  // ovako se definise izlazni objekat jer je moguce da dobijemo gresku prilikom operacije logina
  //dakle, upitnik se stavlja jer je moguce da jedno bude undefined, a zbog nulabilnosti u fields se stavlja type () => 
  @Field(() => [FieldError], {nullable: true})
  errors? : FieldError[]

  @Field(() => User, {nullable: true})
  user?: User
}

@Resolver()
export class UserResolver {

  @Query(() => User, {nullable: true})
  async me(
    @Ctx() { em, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const us: any = req.session.userId as unknown as any;
    const user = await em.findOne(User, {id: us });

    return user
  } 

  @Mutation(()=> UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() {em}: MyContext
  ) : Promise<UserResponse>
  {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "Username is too short"
          }
        ]
      }
    }

    if (options.password.length <= 2) {
      return {
        errors: [
          {
            field: "password",
            message: "Password is too short"
          }
        ]
      }
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword
    });

    try {
      await em.persistAndFlush(user);
    } catch (error) {
      return {
        errors : [
          {
            field: "username",
            message: error.detail,
          }
        ]
    }
  }
    return { 
      user,
     };
  }

  @Mutation(()=> UserResponse)
  async login(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() {em, req }: MyContext
  ) {
    const user = await em.findOne(User, {username: options.username});
    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: 'we have no such username'
          }
        ]
      }
    }
    //komparacija sifri
    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password"
          }
        ]
      }
    }

    // store user id session this will set a cookie for the user
    //sve se moze storati u session objekt, samo tipove usaglasiti... problem
    req.session.userId= user.id as unknown as string;


    return {
        user
      };
  }


  

  
}