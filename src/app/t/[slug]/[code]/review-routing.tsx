"use client";

import { useActionState, useState, useTransition } from "react";

import {
  completeReview,
  ignoreReview,
  submitFeedback,
  type FeedbackState,
} from "./actions";
import { Button } from "@/components/ui/button";
import type { ReviewRoute } from "@/lib/database.types";

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
}: {
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-3 text-sm font-medium text-muted hover:text-dark disabled:opacity-60"
    >
      Ahora no
    </button>
  );
}

const initialFeedback: FeedbackState = {};

export function ReviewRouting({
  route,
  reviewRequestId,
  firstName,
  restaurantName,
}: {
  route: ReviewRoute;
  reviewRequestId: string;
  firstName: string;
  restaurantName: string;
}) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const dismiss = () =>
    startTransition(async () => {
      await ignoreReview(reviewRequestId);
      setDone(true);
    });

  const [fbState, feedbackAction, fbPending] = useActionState(
    submitFeedback.bind(null, reviewRequestId),
    initialFeedback,
  );

  if (done || fbState.done) return <ThankYou firstName={firstName} />;

  if (route === "public_review") {
    const googleUrl =
      "https://www.google.com/search?q=" +
      encodeURIComponent(`${restaurantName} reseñas`);
    const complete = completeReview.bind(null, reviewRequestId, googleUrl);

    return (
      <div className="mt-8 w-full rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-lg font-bold text-dark">
          ¡Gracias por reconocer a nuestro equipo! 💗
        </p>
        <p className="mt-2 text-sm text-muted">
          ¿Te gustaría compartir tu experiencia en Google?
        </p>
        <form action={complete} className="mt-5">
          <Button type="submit" className="h-12 w-full">
            Dejar reseña en Google
          </Button>
        </form>
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
