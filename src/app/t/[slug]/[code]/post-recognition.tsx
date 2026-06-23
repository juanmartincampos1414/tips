"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  captureGuest,
  completeReview,
  ignoreReview,
  submitFeedback,
  type CaptureState,
  type EmittedReward,
  type FeedbackState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { ReviewRoute } from "@/lib/database.types";

type Phase = "review" | "capture" | "reward" | "done";

export function PostRecognition(props: {
  route: ReviewRoute;
  reviewRequestId: string;
  recognitionEventId: string;
  restaurantId: string;
  staffId: string;
  firstName: string;
  restaurantName: string;
  googleReviewUrl: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("review");
  const [reward, setReward] = useState<EmittedReward | null>(null);

  if (phase === "review")
    return (
      <ReviewStep
        route={props.route}
        reviewRequestId={props.reviewRequestId}
        restaurantName={props.restaurantName}
        googleReviewUrl={props.googleReviewUrl}
        onDone={() => setPhase("capture")}
      />
    );

  if (phase === "capture")
    return (
      <GuestCapture
        recognitionEventId={props.recognitionEventId}
        restaurantId={props.restaurantId}
        staffId={props.staffId}
        onDone={(emitted) => {
          if (emitted) {
            setReward(emitted);
            setPhase("reward");
          } else {
            setPhase("done");
          }
        }}
      />
    );

  if (phase === "reward" && reward)
    return <RewardSuccess reward={reward} firstName={props.firstName} />;

  return <ThankYou firstName={props.firstName} />;
}

function RewardSuccess({
  reward,
  firstName,
}: {
  reward: EmittedReward;
  firstName: string;
}) {
  const expDate = new Date(reward.expiration).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="mt-8 w-full text-center">
      <p className="text-lg font-bold text-dark">
        ¡Gracias por reconocer a {firstName}! 🎉
      </p>
      <p className="mt-1 text-sm text-muted">Tenés un beneficio esperándote.</p>

      <div className="mt-5 rounded-2xl bg-pink p-6 text-pink-foreground shadow-sm">
        <p className="text-5xl font-bold">{reward.valueLabel}</p>
        <p className="mt-1 text-base font-semibold">{reward.title}</p>
        <p className="mt-3 text-xs opacity-90">Válido hasta el {expDate}</p>
      </div>

      <a
        href={`/w/${reward.passIdentifier}`}
        className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-pink text-sm font-semibold text-pink-foreground transition-opacity hover:opacity-90"
      >
        Ver mi beneficio
      </a>

      <p className="mt-6 text-xs font-medium text-muted">Guardalo en tu Wallet</p>
      <div className="mt-2 flex gap-2">
        <a
          href={`/api/wallet/apple/${reward.passIdentifier}`}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-dark text-xs font-semibold text-white"
        >
           Apple Wallet
        </a>
        <a
          href={`/api/wallet/google/${reward.passIdentifier}`}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-dark"
        >
          Google Wallet
        </a>
      </div>

      <p className="mt-4 text-xs text-muted">
        Mostralo en tu próxima visita para usarlo. ¡Te esperamos! 💗
      </p>
    </div>
  );
}

function ThankYou({ firstName }: { firstName: string }) {
  return (
    <div className="mt-8 w-full rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-2xl">
        ✓
      </div>
      <p className="mt-4 text-xl font-bold text-dark">
        ¡Gracias por reconocer a {firstName}!
      </p>
      <p className="mt-2 text-sm text-muted">
        Tu reconocimiento quedó registrado. 💗
      </p>
    </div>
  );
}

function DismissButton({
  onClick,
  pending,
  label = "Ahora no",
}: {
  onClick: () => void;
  pending: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-3 text-sm font-medium text-muted hover:text-dark disabled:opacity-60"
    >
      {label}
    </button>
  );
}

const initialFeedback: FeedbackState = {};

function ReviewStep({
  route,
  reviewRequestId,
  restaurantName,
  googleReviewUrl,
  onDone,
}: {
  route: ReviewRoute;
  reviewRequestId: string;
  restaurantName: string;
  googleReviewUrl: string | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [fbState, feedbackAction, fbPending] = useActionState(
    submitFeedback.bind(null, reviewRequestId),
    initialFeedback,
  );

  useEffect(() => {
    if (fbState.done) onDone();
  }, [fbState.done, onDone]);

  const dismiss = () =>
    startTransition(async () => {
      await ignoreReview(reviewRequestId);
      onDone();
    });

  if (route === "public_review") {
    const reviewOnGoogle = () => {
      const url =
        googleReviewUrl ||
        "https://www.google.com/search?q=" +
          encodeURIComponent(`${restaurantName} reseñas`);
      window.open(url, "_blank", "noopener,noreferrer");
      startTransition(async () => {
        await completeReview(reviewRequestId);
        onDone();
      });
    };

    return (
      <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-lg font-bold text-dark">
          ¡Gracias por reconocer a nuestro equipo! 💗
        </p>
        <p className="mt-2 text-sm text-muted">
          ¿Te gustaría compartir tu experiencia en Google?
        </p>
        <Button
          type="button"
          onClick={reviewOnGoogle}
          disabled={pending}
          className="mt-5 h-12 w-full"
        >
          Dejar reseña en Google
        </Button>
        <DismissButton onClick={dismiss} pending={pending} />
      </div>
    );
  }

  // private_feedback (rating <= 3)
  return (
    <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-lg font-bold text-dark">Gracias por tu feedback</p>
      <p className="mt-2 text-sm text-muted">¿Qué podríamos mejorar?</p>
      <form action={feedbackAction} className="mt-4 flex flex-col gap-3">
        <textarea
          name="feedback"
          rows={4}
          autoFocus
          placeholder="Tu comentario nos ayuda a mejorar…"
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-dark outline-none focus:border-pink focus:ring-2 focus:ring-pink/20"
        />
        {fbState.error ? (
          <p className="text-sm text-pink">{fbState.error}</p>
        ) : null}
        <Button type="submit" disabled={fbPending} className="h-12 w-full">
          {fbPending ? "Enviando…" : "Enviar feedback"}
        </Button>
      </form>
      <DismissButton onClick={dismiss} pending={pending} />
    </div>
  );
}

const initialCapture: CaptureState = {};

function GuestCapture({
  recognitionEventId,
  restaurantId,
  staffId,
  onDone,
}: {
  recognitionEventId: string;
  restaurantId: string;
  staffId: string;
  onDone: (reward?: EmittedReward) => void;
}) {
  const action = captureGuest.bind(null, recognitionEventId, restaurantId, staffId);
  const [state, formAction, pending] = useActionState(action, initialCapture);

  useEffect(() => {
    if (state.done) onDone(state.reward);
  }, [state.done, state.reward, onDone]);

  return (
    <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6">
      <p className="text-center text-lg font-bold text-dark">
        Dejanos tus datos
      </p>
      <p className="mt-1 text-center text-sm text-muted">
        Para reconocerte y enviarte beneficios en tu próxima visita.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <Field label="Nombre" name="name" error={undefined}>
          <Input id="name" name="name" placeholder="Tu nombre" autoFocus required />
        </Field>
        <Field label="Email" name="email">
          <Input id="email" name="email" type="email" placeholder="tu@email.com" required />
        </Field>
        <Field label="Teléfono (opcional)" name="phone">
          <Input id="phone" name="phone" placeholder="+54 11 1234 5678" />
        </Field>

        <label className="flex items-start gap-2 text-left text-sm text-muted">
          <input
            type="checkbox"
            name="consent"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-pink"
          />
          Acepto recibir novedades y beneficios.
        </label>

        {state.error ? (
          <p className="text-sm text-pink">{state.error}</p>
        ) : null}

        <Button type="submit" disabled={pending} className="h-12 w-full">
          {pending ? "Guardando…" : "Continuar"}
        </Button>
      </form>

      <div className="text-center">
        <DismissButton onClick={onDone} pending={pending} label="Omitir" />
      </div>
    </div>
  );
}
