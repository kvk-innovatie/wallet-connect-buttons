import { isError, type ErrorType } from "./session/state"

export const errorTypeOrDefault = (e: unknown): ErrorType => {
  if (isError(e)) {
    return e
  } else {
    return "failed"
  }
}
