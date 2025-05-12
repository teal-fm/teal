/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { BlobRef, ValidationResult } from "@atproto/lexicon";
import { HandlerAuth, HandlerPipeThrough } from "@atproto/xrpc-server";
import express from "express";
import { CID } from "multiformats/cid";

import { lexicons } from "../../../../../lexicons";
import { hasProp, isObj } from "../../../../../util";
import * as FmTealAlphaActorDefs from "./defs";

export interface QueryParams {
  /** The search query */
  q: string;
  /** The maximum number of actors to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

export type InputSchema = undefined;

export interface OutputSchema {
  actors: FmTealAlphaActorDefs.MiniProfileView[];
  /** Cursor for pagination */
  cursor?: string;
  [k: string]: unknown;
}

export type HandlerInput = undefined;

export interface HandlerSuccess {
  encoding: "application/json";
  body: OutputSchema;
  headers?: { [key: string]: string };
}

export interface HandlerError {
  status: number;
  message?: string;
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough;
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA;
  params: QueryParams;
  input: HandlerInput;
  req: express.Request;
  res: express.Response;
  resetRouteRateLimits: () => Promise<void>;
};
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput;
