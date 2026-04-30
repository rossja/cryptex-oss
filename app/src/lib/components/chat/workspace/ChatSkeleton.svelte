<div class="flex h-full flex-col gap-3 p-4">
  {#each [0, 1, 2] as i (i)}
    <div class={'flex items-start gap-3 ' + (i % 2 === 0 ? '' : 'flex-row-reverse')}>
      <div class="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted/50"></div>
      <div class="flex flex-col gap-1.5">
        <div class="h-3 w-48 animate-pulse rounded bg-muted/40"></div>
        <div class="h-3 w-72 animate-pulse rounded bg-muted/40"></div>
        <div class="h-3 w-56 animate-pulse rounded bg-muted/40"></div>
      </div>
    </div>
  {/each}
</div>
