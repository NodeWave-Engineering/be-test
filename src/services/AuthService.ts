import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from '@prisma/client';
import { exclude, UserRegisterDTO, UserLoginDTO, UserJWTDAO } from '$entities/User';
import { INTERNAL_SERVER_ERROR_SERVICE_RESPONSE, ServiceResponse } from '$entities/Service';
import { prisma } from "$utils/prisma.utils";
import Logger from "$pkg/logger";


function createToken(user: User) {
  const jwtPayload = exclude(user, "password") as UserJWTDAO
  const token = jwt.sign(jwtPayload, process.env.JWT_SECRET ?? "",{expiresIn:3600});
  return token;
}

export async function logIn(data: UserLoginDTO): Promise<ServiceResponse<any>> {
  try {
    const { email, password } = data;

    const user: any = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = createToken(user);
      return { status: true, data: { user: exclude(user, "password"), token } };
    } else {
      return {
        status: false,
        err: {
          message: "Invalid credential!",
          code: 404,
        },
        data: {},
      };
    }
  } catch (err) {
    Logger.error(`AuthService.login : ${err}`)
    return INTERNAL_SERVER_ERROR_SERVICE_RESPONSE
  }
}

export async function register(data:UserRegisterDTO):Promise<ServiceResponse<any>>{
  try{  

    const newUser = await prisma.user.create({
      data
    })

    const token = createToken(newUser);


    return {
      status:true, 
      data:{
        user: exclude(newUser, "password"), 
        token 
      }
    }

  } catch (err) {
    Logger.error(`AuthService.register : ${err}`)
    return INTERNAL_SERVER_ERROR_SERVICE_RESPONSE
  }
}


export function verifyToken(token:string):ServiceResponse{
  try{
    try {
    const JWT_SECRET = process.env.JWT_SECRET || ""
    jwt.verify(token, JWT_SECRET);
    return {
      status:true,
      data:{}
    }
    } catch (err) {
    
      return {
        status:false,
        err:{
          code:403,
          message:"Invalid Token"
        },
        data:{}
      }
    }
  } catch (err) {
    Logger.error(`AuthService.verifyToken : ${err}`)
    return INTERNAL_SERVER_ERROR_SERVICE_RESPONSE
  }
}


export async function changePassword(userId:string, oldPassword:string, newPassword:string):Promise<ServiceResponse<any>>{
  try{
    const user = await prisma.user.findUnique({where:{
      id:userId
    }})

    const match = await bcrypt.compare(oldPassword, user!.password)

    if(!match){
      return {
        status:false,
        err:{
          code:400,
          message:"Incorrect old password"
        },
        data:{}
      }
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where:{
        id:userId
      },
      data:{
        password:hashedNewPassword
      }
    })

    return {
      status:true,
      data:{}
    }
  }catch(err){
    Logger.error(`AuthService.changePassword : ${err}`)
    return {
        status: false,
        err: { message: (err as Error).message, code: 500 },
        data: {},
      };
  }
}