import { type PropsWithChildren } from 'react';

export default function CustomerLayout({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
                {children}
            </main>
        </div>
    );
}
