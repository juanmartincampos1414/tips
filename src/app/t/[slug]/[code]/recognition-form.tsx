"use client";

import { useActionState, useState } from "react";

import { createRecognition, type RecognitionState } from "./actions";
import { PostRecognition } from "./post-recognition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTED = [1000, 2000, 5000];
const fmt = (n: number) => "$" + n.toLocaleString("es-AR");
const initial: RecognitionState = {};

export function RecognitionForm({
  staffId,
  restaurantId,
  firstName,
  restaurantName,
}: {
  staffId: string;
  restaurantId: string;
  firstName: string;
  restaurantName: string;
}) {
  const action = createRecognition.bind(null, staffId, restaurantId);
  const [state, formAction, pending] = useActionState(action, initial);

  const [amount, setAmount] = useState<number | "">("");
  const [custom, setCustom] = useState(false);
  const [rating, setRating] = useState(0);

  if (
    state.ok &&
    state.route &&
    state.reviewRequestId &&
    state.recognitionEventId
  ) {
    return (
      <PostRecognition
        route={state.route}
        reviewRequestId={state.reviewRequestId}
        recognitionEventId={state.recognitionEventId}
        restaurantId={restaurantId}
        staffId={staffId}
        firstName={firstName}
        restaurantName={restaurantName}
      />
    );
  }

  return (
    <form action={formAction} className="mt-8 flex w-full flex-col gap-6">
      <input type="hidden" name="amount" value={amount === "" ? "" : amount} />
      <input type="hidden" name="rating" value={rating || ""} />

      {/* Tip */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-dark">
          Dejá una propina <span className="font-normal text-muted">(opcional)</span>
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {SUGGESTED.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => {
                setAmount(v);
                setCustom(false);
              }}
              className={cn(
                "h-12 rounded-xl border text-sm font-semibold transition-colors",
                amount === v && !custom
                  ? "border-pink bg-pink text-pink-foreground"
                  : "border-border bg-card text-dark hover:bg-background",
              )}
            >
              {fmt(v)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            setAmount("");
          }}
          className={cn(
            "mt-2 h-10 w-full rounded-xl border text-sm font-medium transition-colors",
            custom
              ? "border-pink text-pink"
              : "border-border text-muted hover:bg-background",
          )}
        >
          Otro importe
        </button>
        {custom ? (
          <input
            type="number"
            min={0}
            inputMode="numeric"
            autoFocus
            placeholder="Ingresá un monto"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm text-dark outline-none focus:border-pink focus:ring-2 focus:ring-pink/20"
          />
        ) : null}
      </section>

      {/* Rating */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-dark">
          ¿Cómo fue la atención?
        </h2>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              aria-label={`${n} estrellas`}
              onClick={() => setRating(n)}
              className={cn(
                "text-4xl transition-transform hover:scale-110",
                n <= rating ? "text-pink" : "text-border",
              )}
            >
              ★
            </button>
          ))}
        </div>
      </section>

      {state.error ? (
        <p className="rounded-xl bg-pink/10 px-4 py-3 text-center text-sm text-pink">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || rating === 0}
        className="h-12 w-full"
      >
        {pending ? "Registrando…" : "Reconocer servicio"}
      </Button>
    </form>
  );
}
