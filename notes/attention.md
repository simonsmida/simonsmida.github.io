---
layout: single
title: "Attention, in 5min"
excerpt: "A first-principles, no-hype walkthrough of attention in transformers."
categories:
  - transformers
  - deep-learning
classes: wide
tags:
  - attention
  - transformers
  - vit
  - self-attention
  - deep-learning
author_profile: false
share: false
related: false
read_time: true
---

![lucifer](images/lucifer.png)
> Attention to God I guess... Or vice-versa.

<blockquote class="twitter-tweet">
  <p lang="en" dir="ltr">Funny, this was posted literally the minute I finished the post T_T..</p>
  ![mock](images/lucifer-mock.png)
</blockquote>

---

## TL;DR — the mental model

If you want to keep only one picture in your head, keep this:

- A transformer works on a **sequence of vectors** (tokens)
- **Attention** lets each token decide **which other tokens matter**
- It does so by:
  - comparing tokens (similarity),
  - turning similarities into weights,
  - mixing information accordingly
- **Q, K, V** are *different learned linear views* of the same token vectors
- Attention mainly does **communication / mixing**, not feature creation (that’s mostly the MLP)
- Without positional information, attention does **not know order**

Everything below just fills in the details.

---

🧙🏻‍♂️: Let's try to unpack this *magic* word.

---

## 1. Transformers and sequences

Transformer architecture is *designed* to work with *sequence* data.  
Sequence = sentence of words, image of patches, ...

- elements of a sequence are not necessarily vectors; they can be *anything*!

Input sequence:

$$
el_1, el_2, \dots el_n
$$

(totally *not* vectors yet)

> **NOTE (EDIT):**  
> Yeah well, chatGPT was harsh, and told me this was too philosophical and technically sloppy.  
> So to be precise: in a **transformer**, elements actually **must be representable as vectors** *before* attention.  
> This doesn’t contradict the intuition — it just makes the constraint explicit.

---

## 2. From elements to vectors

But we use computers; we want vectors = we could do linear algebra, right?

**Q:** How to get vectors?  
**A:** linear projection

Well, well, well... does this make sense? What is input to linear projection?

- it MUST be a vector even here!
- it is a RAW vector representation of an input element
- ~~raw vector elements don't necessarily need to be of same size~~ (this was bs)
  - linear projection actually requires *fixed input* dimensionality (makes sense)

> **NOTE (EDIT):**  
> Got roasted again. Linear projection is **not THE way**.  
> There are multiple ways to obtain embeddings:
> - text → embedding **lookup table**
> - images → often **linear projection of patches** (ViT case)
>  
> I was implicitly thinking ViT here, but this distinction matters.

Ok, so linear projection is mainly about producing *embedding* vectors from *raw* data.  
So they start behaving.

> **NOTE (EDIT):**  
> chatGPT correction, phrased cleanly:  
> *“An initial embedding step maps raw data to vectors.  
> Later linear projections (Q, K, V) re-express those vectors for attention.”*

> **IMPORTANT:**  
> We want — and for attention we *need* — a **shared latent space**,  
> with controlled dimensionality for all tokens,  
> so dot products and mixing are even meaningful.

---

## 3. Where we are so far

So far:

$$
el_i \;\to\; \text{embedding step} \;\to\; x_i
$$

---

## 4. Is this enough?

Ok, is this enough?  
No. Later on, for some tasks, we often add a thing called **CLS token**.

But we'll get there later on.

> **NOTE (EDIT):**  
> Apparently (thanks chatGPT), the **CLS token is task-specific**,  
> mainly used for **classification**, not something the transformer *fundamentally* needs to operate.

---

## 5. What do embeddings actually do?

Ok, great, we have *embeddings*, fancy word for *vectors*.  
What can we do with these vectors? What do we *want* to do with the vectors??

We'd like to assess their meaning, or rather **give them meaning**.

- chatGPT KNOWS what the meaning is!
- → *“We want each vector to incorporate information from other relevant vectors.”* — chatGPT

How do they relate?  
How do they influence each other?  
How they interact?

To **give them meaning**, and a better one than just the recently done embedding step,  
we’d like to transform them again, and transform them to somewhere *meaningful*.

How? **attention**, duh... but why?

- 1 output for 1 input
- shared mechanism
- interaction

---

## 6. Why attention?

Well, let's backtrack. Attention is an operation, but it is not immediately clear why specifically we chose it.

What we want is to assess which vectors are somehow *similar*, or *related*.  
*Similar*, or *related* vectors should *interact more*.

How to assess this?

- we must **compare** the **vectors** somehow
- we want to produce some **scalar score** per vector pair

Perfect candidate for this is dot product!  
And it's *cheap*, *scales well*, and *differentiable*.

Input embeddings:

$$
x_1, x_2, \dots x_n
$$

Similarity score:

$$
\text{Score}(i, j) = x_i \cdot x_j
$$

…eeeh… this *should* work in principle,  
but is apparently not enough (but why?).

**Q, K, V for the rescue.**

---

## 7. Q, K, V (role play time)

I said Q, K, V for the rescue!!  
Yeah, these letters. We need to role play.

From Q, K, V we want to represent distinct roles:

- Decide **what** the vector **is looking for** → **Q**
- Decide **how** the vector **should be matched** → **K**
- Decide **what information** the vector **transmits** → **V**

Mystical, needs *polish*ing (🇵🇱 mentioned).

Important thing:

> **Q, K, V are not concepts.**  
> They are **learned linear projections** defining different similarity and information spaces.

Every input gets its own Q, K, V:

$$
Q = X W_Q
$$

$$
K = X W_K
$$

$$
V = X W_V
$$

---

## 8. The attention formula

Then attention is simple. Just blindly follow the formula:

$$
\mathrm{Attention}(X) =
\mathrm{softmax}\left(
\frac{Q K^\top}{\sqrt{d_k}}
\right)
V
$$

bjada.  
Not hard tho — we already have Q, K, V.

And $d_k$?  
Not some mystical constant — it prevents dot products from growing with dimension  
and keeps the softmax in a sane regime.

---

## 9. What the formula actually does

Let’s unpack it again.

- $QK^\top$ → pairwise similarity scores
- softmax → normalized attention weights
- weighted sum of $V$ → information mixing

In the end:

input vectors (sequence)  
→ **attention**  
→ sequence *with contextual information*

---

## 10. Single vs multi-head attention

So we done? Basically. But not practically.

What we’ve described so far is **single self-attention**.  
But this is ~~weak~~ **limited to one similarity space**.

It learns a *single* notion of relevance.

Why stop there?

Why not:
- multiple similarity spaces,
- multiple notions of relevance,
- computed in parallel?

Yeah. That’s **multi-head attention**.

---

## 11. One crucial thing I forgor

So yeah, I totally forgot the most important thing at first.

Here it is:

> **“Attention alone is permutation-invariant,  
> so positional information must be added separately.”** — chatGPT banger
